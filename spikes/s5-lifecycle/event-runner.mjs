import { createHash } from 'node:crypto';

import {
  LifecycleCore,
  ResourceLedger,
  deferred,
} from './lifecycle-core.mjs';

const OCCURRED_AT = '2026-09-06T00:00:00.000Z';

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function event(eventId, eventInstanceId, payload = {}) {
  return {
    eventId,
    version: '1.0.0',
    eventInstanceId,
    occurredAt: OCCURRED_AT,
    correlationId: 'correlation-root',
    payload,
  };
}

function envelopeSummary(envelope) {
  return {
    eventId: envelope.eventId,
    eventInstanceId: envelope.eventInstanceId,
    correlationId: envelope.correlationId,
    causationId: envelope.causationId,
    dispatchDepth: envelope.dispatchDepth,
  };
}

async function rejection(promise) {
  try {
    await promise;
  } catch (error) {
    if (error?.diagnostic !== undefined) return { ...error.diagnostic };
    throw error;
  }
  throw new Error('Event publish unexpectedly resolved.');
}

function runtimeFixture({ handlers = [], onFactory, onStart, onStop, entryIds = ['A'] } = {}) {
  const trace = [];
  const ledger = new ResourceLedger(trace);
  const entries = entryIds.map(id => ({
    id,
    factory(context) {
      onFactory?.(id, context);
      return {
        async start(startContext) {
          await onStart?.(id, startContext);
        },
        async stop() {
          await onStop?.(id);
        },
      };
    },
  }));
  return {
    runtime: new LifecycleCore({ entries, handlers, ledger, trace }),
    trace,
  };
}

async function lifecycleRejections() {
  const pending = [];
  let handlerRuns = 0;
  const handlers = [{
    id: 'handler.lifecycle',
    eventId: 'event.lifecycle',
    async handle() {
      handlerRuns += 1;
    },
  }];
  const { runtime, trace } = runtimeFixture({
    handlers,
    onFactory(_id, { publish }) {
      pending.push(rejection(publish(event('event.lifecycle', 'factory-event'))));
    },
    onStart(_id, { publish }) {
      pending.push(rejection(publish(event('event.lifecycle', 'start-event'))));
    },
  });

  const register = await rejection(runtime.publish(event('event.lifecycle', 'register-event')));
  await runtime.start();
  const stopPromise = runtime.stop();
  const stopping = await rejection(runtime.publish(event('event.lifecycle', 'stopping-event')));
  await stopPromise;
  const [factory, start] = await Promise.all(pending);

  return {
    id: 'lifecycle-rejections',
    trace,
    diagnostics: [],
    rejections: [register, factory, start, stopping],
    handlerRuns,
    finalState: runtime.state,
  };
}

async function stableOrderAndFailure() {
  const handlerOrder = [];
  const envelopes = [];
  const makeHandler = (id, fail = false) => ({
    id,
    eventId: 'event.ordered',
    async handle({ envelope }) {
      handlerOrder.push(id);
      envelopes.push(envelopeSummary(envelope));
      if (fail) throw new Error('ordered middle handler failed.');
    },
  });
  const { runtime, trace } = runtimeFixture({
    handlers: [makeHandler('handler.z'), makeHandler('handler.m', true), makeHandler('handler.a')],
  });
  await runtime.start();
  await runtime.publish(event('event.ordered', 'ordered-root'));
  await runtime.stop();
  return {
    id: 'stable-order-and-handler-failure',
    trace,
    diagnostics: runtime.eventDiagnostics(),
    handlerOrder,
    envelopes,
    publishResolved: true,
    finalState: runtime.state,
  };
}

async function nestedDepthFirst() {
  const dispatchTrace = [];
  const envelopes = [];
  let lifecycleTrace;
  const record = (label, envelope) => {
    dispatchTrace.push(label);
    lifecycleTrace.push(label);
    envelopes.push(envelopeSummary(envelope));
  };
  const handlers = [
    {
      id: 'root.a',
      eventId: 'event.root',
      async handle({ envelope, publish }) {
        record('root.a:start', envelope);
        await publish(event('event.child', 'child-1'));
        dispatchTrace.push('root.a:end');
        lifecycleTrace.push('root.a:end');
      },
    },
    {
      id: 'root.z',
      eventId: 'event.root',
      async handle({ envelope }) {
        record('root.z', envelope);
      },
    },
    {
      id: 'child.a',
      eventId: 'event.child',
      async handle({ envelope, publish }) {
        record('child.a:start', envelope);
        await publish(event('event.leaf', 'leaf-1'));
        dispatchTrace.push('child.a:end');
        lifecycleTrace.push('child.a:end');
      },
    },
    {
      id: 'child.z',
      eventId: 'event.child',
      async handle({ envelope }) {
        record('child.z', envelope);
      },
    },
    {
      id: 'leaf.a',
      eventId: 'event.leaf',
      async handle({ envelope }) {
        record('leaf.a', envelope);
      },
    },
  ];
  const fixture = runtimeFixture({ handlers });
  const { runtime } = fixture;
  lifecycleTrace = fixture.trace;
  await runtime.start();
  await runtime.publish(event('event.root', 'root-1'));
  await runtime.stop();
  return {
    id: 'nested-depth-first',
    trace: lifecycleTrace,
    dispatchTrace,
    diagnostics: runtime.eventDiagnostics(),
    envelopes,
    finalState: runtime.state,
  };
}

async function depthLimit() {
  const recurseDepths = [];
  const tailDepths = [];
  const handlers = [
    {
      id: 'loop.a-recurse',
      eventId: 'event.loop',
      async handle({ envelope, publish }) {
        recurseDepths.push(envelope.dispatchDepth);
        await publish(event('event.loop', `loop-${envelope.dispatchDepth + 1}`));
      },
    },
    {
      id: 'loop.z-tail',
      eventId: 'event.loop',
      async handle({ envelope }) {
        tailDepths.push(envelope.dispatchDepth);
      },
    },
  ];
  const { runtime, trace } = runtimeFixture({ handlers });
  await runtime.start();
  await runtime.publish(event('event.loop', 'loop-1'));
  await runtime.stop();
  return {
    id: 'depth-limit',
    trace,
    diagnostics: runtime.eventDiagnostics(),
    recurseDepths,
    tailDepths,
    maxObservedDepth: Math.max(...recurseDepths, ...tailDepths),
    finalState: runtime.state,
  };
}

async function activeDispatchDrain() {
  const gate = { entered: deferred(), release: deferred() };
  let lifecycleTrace;
  const handlers = [{
    id: 'slow.handler',
    eventId: 'event.slow',
    async handle() {
      lifecycleTrace.push('handler:slow:start');
      gate.entered.resolve();
      await gate.release.promise;
      lifecycleTrace.push('handler:slow:end');
    },
  }];
  const fixture = runtimeFixture({ handlers, entryIds: ['A', 'B'] });
  const { runtime } = fixture;
  lifecycleTrace = fixture.trace;
  await runtime.start();
  const publishPromise = runtime.publish(event('event.slow', 'slow-1'));
  await gate.entered.promise;
  const stopPromise = runtime.stop();
  const stoppedBeforeHandlerRelease = lifecycleTrace.some(item => item.startsWith('stop:'));
  const stoppedRejection = await rejection(runtime.publish(event('event.slow', 'slow-2')));
  gate.release.resolve();
  await Promise.all([publishPromise, stopPromise]);
  return {
    id: 'active-dispatch-drain',
    trace: lifecycleTrace,
    diagnostics: runtime.eventDiagnostics(),
    rejection: stoppedRejection,
    stoppedBeforeHandlerRelease,
    finalState: runtime.state,
  };
}

async function executeScenarios() {
  return [
    await lifecycleRejections(),
    await stableOrderAndFailure(),
    await nestedDepthFirst(),
    await depthLimit(),
    await activeDispatchDrain(),
  ];
}

export async function runEventDispatchMatrix() {
  const first = await executeScenarios();
  const second = await executeScenarios();
  if (stableJson(first) !== stableJson(second)) {
    throw new Error('S5 Event dispatch output changed across repeated deterministic runs.');
  }
  return {
    schemaVersion: '1',
    environment: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
    },
    matrix: { runCount: 2, scenarioCount: first.length },
    matrixHash: sha256(stableJson(first)),
    scenarios: first,
  };
}
