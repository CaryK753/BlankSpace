export const MAX_DISPATCH_DEPTH = 32;

function compareHandlerIds(left, right) {
  if (left.id < right.id) return -1;
  if (left.id > right.id) return 1;
  return 0;
}

function lifecycleDiagnostic(event, phase) {
  return {
    code: 'E_EVENT_PUBLISH_LIFECYCLE',
    phase,
    eventId: event.eventId,
    eventInstanceId: event.eventInstanceId,
    message: `Event ${event.eventId} cannot be published during ${phase}.`,
  };
}

function depthDiagnostic(envelope) {
  return {
    code: 'E_EVENT_DISPATCH_DEPTH',
    phase: 'dispatch',
    eventId: envelope.eventId,
    eventInstanceId: envelope.eventInstanceId,
    dispatchDepth: envelope.dispatchDepth,
    message: `Event ${envelope.eventId} exceeds maximum dispatch depth ${MAX_DISPATCH_DEPTH}.`,
  };
}

export class EventDispatchError extends Error {
  constructor(diagnostic) {
    super(diagnostic.message);
    this.name = 'EventDispatchError';
    this.code = diagnostic.code;
    this.diagnostic = diagnostic;
  }
}

export class InProcessEventDispatcher {
  #active = new Set();
  #diagnostics = [];
  #getPhase;
  #handlersByEvent = new Map();

  constructor({ handlers = [], getPhase }) {
    this.#getPhase = getPhase;
    for (const handler of [...handlers].sort(compareHandlerIds)) {
      const group = this.#handlersByEvent.get(handler.eventId) ?? [];
      group.push(handler);
      this.#handlersByEvent.set(handler.eventId, group);
    }
  }

  publish(event) {
    const rejected = this.#rejectUnlessReady(event);
    if (rejected !== null) return Promise.reject(rejected);

    const envelope = {
      eventId: event.eventId,
      version: event.version,
      eventInstanceId: event.eventInstanceId,
      occurredAt: event.occurredAt,
      correlationId: event.correlationId ?? event.eventInstanceId,
      causationId: event.causationId ?? null,
      dispatchDepth: 1,
    };
    const task = this.#dispatch(envelope, event.payload);
    this.#active.add(task);
    task.then(
      () => this.#active.delete(task),
      () => this.#active.delete(task),
    );
    return task;
  }

  async drain() {
    while (this.#active.size > 0) {
      await Promise.allSettled([...this.#active]);
    }
  }

  diagnostics() {
    return this.#diagnostics.map(diagnostic => ({ ...diagnostic }));
  }

  async #dispatch(envelope, payload) {
    const handlers = this.#handlersByEvent.get(envelope.eventId) ?? [];
    for (const handler of handlers) {
      try {
        await handler.handle({
          envelope: { ...envelope },
          payload,
          publish: event => this.#publishNested(event, envelope),
        });
      } catch (error) {
        this.#diagnostics.push(this.#handlerDiagnostic(error, handler.id, envelope));
      }
    }
  }

  #publishNested(event, parent) {
    const rejected = this.#rejectUnlessReady(event);
    if (rejected !== null) return Promise.reject(rejected);

    const envelope = {
      eventId: event.eventId,
      version: event.version,
      eventInstanceId: event.eventInstanceId,
      occurredAt: event.occurredAt,
      correlationId: parent.correlationId,
      causationId: parent.eventInstanceId,
      dispatchDepth: parent.dispatchDepth + 1,
    };
    if (envelope.dispatchDepth > MAX_DISPATCH_DEPTH) {
      return Promise.reject(new EventDispatchError(depthDiagnostic(envelope)));
    }
    return this.#dispatch(envelope, event.payload);
  }

  #rejectUnlessReady(event) {
    const phase = this.#getPhase();
    return phase === 'ready'
      ? null
      : new EventDispatchError(lifecycleDiagnostic(event, phase));
  }

  #handlerDiagnostic(error, handlerId, envelope) {
    const cause = error instanceof EventDispatchError
      ? error.diagnostic
      : {
          code: 'E_EVENT_HANDLER_FAILED',
          message: error instanceof Error ? error.message : String(error),
        };
    return {
      code: cause.code,
      phase: 'dispatch',
      handlerId,
      eventId: cause.eventId ?? envelope.eventId,
      eventInstanceId: cause.eventInstanceId ?? envelope.eventInstanceId,
      dispatchDepth: cause.dispatchDepth ?? envelope.dispatchDepth,
      message: cause.message,
    };
  }
}
