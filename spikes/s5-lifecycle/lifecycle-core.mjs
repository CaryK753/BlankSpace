import { InProcessEventDispatcher } from './event-dispatch-core.mjs';

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

export function fixtureError(code, message, extras = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extras);
  return error;
}

function diagnosticFromError(error, fallback) {
  return {
    code: typeof error?.code === 'string' ? error.code : fallback.code,
    entryId: fallback.entryId,
    phase: fallback.phase,
    ...(typeof error?.resourceId === 'string' ? { resourceId: error.resourceId } : {}),
    message: error instanceof Error ? error.message : String(error),
  };
}

export class ResourceLedger {
  #records = new Map();
  #trace;

  constructor(trace) {
    this.#trace = trace;
  }

  acquire(ownerId, resourceId) {
    if (this.#records.has(resourceId)) {
      throw fixtureError('E_RESOURCE_DUPLICATE_ACQUIRE', `Resource ${resourceId} was acquired more than once.`, { resourceId });
    }
    this.#records.set(resourceId, {
      ownerId,
      resourceId,
      acquireCount: 1,
      releaseAttempts: 0,
      releaseCount: 0,
      active: true,
    });
    this.#trace.push(`acquire:${ownerId}:${resourceId}`);
  }

  release(ownerId, resourceId, options = {}) {
    const record = this.#records.get(resourceId);
    if (record === undefined) {
      throw fixtureError('E_RESOURCE_UNKNOWN', `Resource ${resourceId} is unknown.`, { resourceId });
    }
    if (record.ownerId !== ownerId) {
      throw fixtureError('E_RESOURCE_OWNER_MISMATCH', `Resource ${resourceId} belongs to ${record.ownerId}, not ${ownerId}.`, { resourceId });
    }
    if (!record.active) {
      throw fixtureError('E_RESOURCE_DOUBLE_RELEASE', `Resource ${resourceId} was already released.`, { resourceId });
    }

    record.releaseAttempts += 1;
    this.#trace.push(`release:${ownerId}:${resourceId}${options.fail ? ':fail' : ''}`);
    if (options.fail) {
      throw fixtureError('E_RESOURCE_RELEASE_FAILED', `Resource ${resourceId} failed to release.`, { resourceId });
    }
    record.releaseCount += 1;
    record.active = false;
  }

  isActive(resourceId) {
    return this.#records.get(resourceId)?.active === true;
  }

  residuals(ownerId) {
    return [...this.#records.values()]
      .filter(record => record.ownerId === ownerId && record.active)
      .map(record => record.resourceId)
      .sort();
  }

  snapshot() {
    const resources = [...this.#records.values()]
      .map(record => ({ ...record }))
      .sort((left, right) => left.resourceId.localeCompare(right.resourceId));
    return {
      balance: resources.filter(resource => resource.active).length,
      resources,
    };
  }
}

export class LifecycleRunError extends Error {
  constructor({ primary, diagnostics, resources, trace }) {
    super(`${primary.code} ${primary.entryId ?? 'runtime'} ${primary.phase}: ${primary.message}`);
    this.name = 'LifecycleRunError';
    this.primary = primary;
    this.diagnostics = diagnostics;
    this.resources = resources;
    this.trace = trace;
  }
}

export class LifecycleCore {
  #entries;
  #ledger;
  #trace;
  #started = [];
  #stopRequested = false;
  #stopTask = null;
  #shutdown = deferred();
  #shutdownResolved = false;
  #shutdownResult = null;
  #events;

  constructor({ entries, handlers = [], ledger, trace }) {
    this.#entries = entries;
    this.#ledger = ledger;
    this.#trace = trace;
    this.state = 'idle';
    this.phase = 'register';
    this.readyCount = 0;
    this.#events = new InProcessEventDispatcher({
      handlers,
      getPhase: () => this.phase,
    });
  }

  publish(event) {
    return this.#events.publish(event);
  }

  eventDiagnostics() {
    return this.#events.diagnostics();
  }

  async start() {
    if (this.state !== 'idle') throw new Error(`Lifecycle start requires idle state, received ${this.state}.`);
    this.state = 'starting';

    for (const spec of this.#entries) {
      if (this.#stopRequested) return this.#stopBeforeReady();

      this.phase = 'factory';
      this.#trace.push(`factory:${spec.id}`);
      let instance;
      try {
        instance = spec.factory({ publish: event => this.publish(event) });
      } catch (error) {
        return this.#startupFailure(spec.id, 'factory', error);
      }

      this.phase = 'start';
      this.#trace.push(`start:${spec.id}`);
      try {
        await instance.start?.({ publish: event => this.publish(event) });
      } catch (error) {
        return this.#startupFailure(spec.id, 'start', error);
      }
      this.#started.push({ id: spec.id, instance });

      if (this.#stopRequested) return this.#stopBeforeReady();
    }

    if (this.#stopRequested) return this.#stopBeforeReady();
    this.state = 'ready';
    this.phase = 'ready';
    this.readyCount += 1;
    this.#trace.push('ready');
    return { status: 'ready', state: this.state };
  }

  stop() {
    if (this.state === 'starting') {
      this.#stopRequested = true;
      return this.#shutdown.promise;
    }

    if (this.state === 'ready') {
      void this.#performStop('requested');
      return this.#shutdown.promise;
    }

    if (this.state === 'stopping') return this.#shutdown.promise;

    if (this.state === 'stopped' || this.state === 'failed') {
      if (!this.#shutdownResolved) {
        this.#resolveShutdown(this.#shutdownResult ?? this.#terminalResult(this.state, []));
      }
      return this.#shutdown.promise;
    }

    if (this.state === 'idle') {
      this.state = 'stopped';
      this.phase = 'stopped';
      this.#resolveShutdown(this.#terminalResult('stopped', []));
      return this.#shutdown.promise;
    }

    return this.#shutdown.promise;
  }

  async #stopBeforeReady() {
    const shutdown = await this.#performStop('start-cancelled');
    return { status: 'stopped-before-ready', state: this.state, shutdown };
  }

  async #startupFailure(entryId, phase, error) {
    const primary = diagnosticFromError(error, {
      code: phase === 'factory' ? 'E_FACTORY_FAILED' : 'E_START_FAILED',
      entryId,
      phase,
    });
    const diagnostics = [];

    if (Array.isArray(error?.cleanupDiagnostics)) {
      diagnostics.push(...error.cleanupDiagnostics.map(item => ({ ...item })));
    }

    const stopDiagnostics = await this.#stopStarted();
    diagnostics.push(...stopDiagnostics);
    this.state = 'failed';
    this.phase = 'failed';
    const terminal = this.#terminalResult('failed', diagnostics);
    this.#shutdownResult = terminal;
    this.#resolveShutdown(terminal);

    throw new LifecycleRunError({
      primary,
      diagnostics,
      resources: this.#ledger.snapshot(),
      trace: [...this.#trace],
    });
  }

  async #performStop(reason) {
    if (this.#stopTask !== null) return this.#stopTask;
    this.#stopTask = (async () => {
      this.state = 'stopping';
      this.phase = 'stopping';
      this.#trace.push(`stopping:${reason}`);
      await this.#events.drain();
      const diagnostics = await this.#stopStarted();
      this.state = 'stopped';
      this.phase = 'stopped';
      const result = this.#terminalResult('stopped', diagnostics);
      this.#shutdownResult = result;
      this.#resolveShutdown(result);
      return result;
    })();
    return this.#stopTask;
  }

  async #stopStarted() {
    const diagnostics = [];
    const started = this.#started;
    this.#started = [];
    for (let index = started.length - 1; index >= 0; index -= 1) {
      const item = started[index];
      this.#trace.push(`stop:${item.id}`);
      try {
        await item.instance.stop?.();
      } catch (error) {
        diagnostics.push(diagnosticFromError(error, {
          code: 'E_STOP_FAILED',
          entryId: item.id,
          phase: 'stop',
        }));
      }
    }
    return diagnostics;
  }

  #terminalResult(state, diagnostics) {
    return {
      state,
      diagnostics: diagnostics.map(item => ({ ...item })),
      resources: this.#ledger.snapshot(),
      trace: [...this.#trace],
      readyCount: this.readyCount,
    };
  }

  #resolveShutdown(result) {
    if (this.#shutdownResolved) return;
    this.#shutdownResolved = true;
    this.#shutdown.resolve(result);
  }
}
