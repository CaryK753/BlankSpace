import { createHash } from 'node:crypto';

import {
  LifecycleCore,
  LifecycleRunError,
  ResourceLedger,
  deferred,
  fixtureError,
} from './lifecycle-core.mjs';

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function cleanupDiagnostic(error, entryId) {
  return {
    code: typeof error?.code === 'string' ? error.code : 'E_RESOURCE_RELEASE_FAILED',
    entryId,
    phase: 'start-cleanup',
    ...(typeof error?.resourceId === 'string' ? { resourceId: error.resourceId } : {}),
    message: error instanceof Error ? error.message : String(error),
  };
}

function makeEntrySpec(id, ledger, controls, behavior = {}) {
  const resourceId = `${id}.primary`;
  return {
    id,
    factory() {
      if (behavior.factoryFailure) {
        throw fixtureError(`E_${id}_FACTORY_FAILED`, `${id} factory failed.`);
      }

      return {
        async start() {
          if (behavior.startFailure === 'before-resource') {
            throw fixtureError(`E_${id}_START_FAILED`, `${id} start failed before acquiring a resource.`);
          }

          ledger.acquire(id, resourceId);

          if (behavior.startGate) {
            behavior.startGate.entered.resolve();
            await behavior.startGate.release.promise;
          }

          if (behavior.startFailure === 'partial-clean' || behavior.startFailure === 'partial-cleanup-fail') {
            const cleanupDiagnostics = [];
            try {
              ledger.release(id, resourceId, { fail: behavior.startFailure === 'partial-cleanup-fail' });
            } catch (error) {
              cleanupDiagnostics.push(cleanupDiagnostic(error, id));
            }
            throw fixtureError(`E_${id}_START_FAILED`, `${id} start failed after acquiring a resource.`, {
              cleanupDiagnostics,
            });
          }
        },

        async stop() {
          if (behavior.stopGate) {
            behavior.stopGate.entered.resolve();
            await behavior.stopGate.release.promise;
          }
          if (ledger.isActive(resourceId)) ledger.release(id, resourceId);
          if (behavior.stopFailure) {
            throw fixtureError(`E_${id}_STOP_FAILED`, `${id} stop failed after releasing owned resources.`);
          }
        },
      };
    },
  };
}

function fixture(behaviors = {}) {
  const trace = [];
  const ledger = new ResourceLedger(trace);
  const controls = {};
  const entries = ['A', 'B', 'C', 'D'].map(id => makeEntrySpec(id, ledger, controls, behaviors[id] ?? {}));
  const runtime = new LifecycleCore({ entries, ledger, trace });
  return { runtime, ledger, trace, controls };
}

function summarizeTerminal(id, outcome, runtime, terminal, extras = {}) {
  return {
    id,
    outcome,
    state: runtime.state,
    readyCount: runtime.readyCount,
    primaryError: null,
    diagnostics: terminal.diagnostics,
    trace: terminal.trace,
    resourceBalance: terminal.resources.balance,
    resources: terminal.resources.resources,
    ...extras,
  };
}

function summarizeFailure(id, runtime, error, extras = {}) {
  if (!(error instanceof LifecycleRunError)) throw error;
  return {
    id,
    outcome: 'startup-failed',
    state: runtime.state,
    readyCount: runtime.readyCount,
    primaryError: error.primary,
    diagnostics: error.diagnostics,
    trace: error.trace,
    resourceBalance: error.resources.balance,
    resources: error.resources.resources,
    ...extras,
  };
}

async function successfulShutdown() {
  const { runtime } = fixture();
  await runtime.start();
  const shutdown = await runtime.stop();
  return summarizeTerminal('success', 'stopped', runtime, shutdown);
}

async function factoryFailure() {
  const { runtime } = fixture({ C: { factoryFailure: true } });
  try {
    await runtime.start();
    throw new Error('Factory failure fixture unexpectedly reached ready.');
  } catch (error) {
    return summarizeFailure('factory-failure-c', runtime, error);
  }
}

async function startFailureBeforeResource() {
  const { runtime } = fixture({ C: { startFailure: 'before-resource' } });
  try {
    await runtime.start();
    throw new Error('Start-before-resource fixture unexpectedly reached ready.');
  } catch (error) {
    return summarizeFailure('start-failure-before-resource-c', runtime, error);
  }
}

async function partialStartFailureClean() {
  const { runtime } = fixture({ C: { startFailure: 'partial-clean' } });
  try {
    await runtime.start();
    throw new Error('Partial-start cleanup fixture unexpectedly reached ready.');
  } catch (error) {
    return summarizeFailure('partial-start-clean-c', runtime, error);
  }
}

async function partialStartCleanupFailure() {
  const { runtime } = fixture({ C: { startFailure: 'partial-cleanup-fail' } });
  try {
    await runtime.start();
    throw new Error('Partial-start cleanup-failure fixture unexpectedly reached ready.');
  } catch (error) {
    return summarizeFailure('partial-start-cleanup-failure-c', runtime, error);
  }
}

async function stopFailure() {
  const { runtime } = fixture({ C: { stopFailure: true } });
  await runtime.start();
  const shutdown = await runtime.stop();
  return summarizeTerminal('stop-failure-c', 'stopped-with-diagnostics', runtime, shutdown);
}

async function sequentialStop() {
  const { runtime } = fixture();
  await runtime.start();
  const firstPromise = runtime.stop();
  const first = await firstPromise;
  const secondPromise = runtime.stop();
  const second = await secondPromise;
  return summarizeTerminal('sequential-double-stop', 'stopped', runtime, second, {
    stopPromiseShared: firstPromise === secondPromise,
    terminalResultShared: first === second,
  });
}

async function concurrentStop() {
  const stopGate = { entered: deferred(), release: deferred() };
  const { runtime } = fixture({ D: { stopGate } });
  await runtime.start();
  const firstPromise = runtime.stop();
  await stopGate.entered.promise;
  const secondPromise = runtime.stop();
  const stopPromiseShared = firstPromise === secondPromise;
  stopGate.release.resolve();
  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  return summarizeTerminal('concurrent-stop', 'stopped', runtime, second, {
    stopPromiseShared,
    terminalResultShared: first === second,
  });
}

async function stopDuringStart() {
  const startGate = { entered: deferred(), release: deferred() };
  const { runtime } = fixture({ C: { startGate } });
  const startPromise = runtime.start();
  await startGate.entered.promise;
  const stopPromise = runtime.stop();
  startGate.release.resolve();
  const [startResult, shutdown] = await Promise.all([startPromise, stopPromise]);
  return summarizeTerminal('stop-during-start-c', startResult.status, runtime, shutdown, {
    startResult: startResult.status,
  });
}

async function executeScenarios() {
  return [
    await successfulShutdown(),
    await factoryFailure(),
    await startFailureBeforeResource(),
    await partialStartFailureClean(),
    await partialStartCleanupFailure(),
    await stopFailure(),
    await sequentialStop(),
    await concurrentStop(),
    await stopDuringStart(),
  ];
}

export async function runLifecycleMatrix() {
  const first = await executeScenarios();
  const second = await executeScenarios();
  if (stableJson(first) !== stableJson(second)) {
    throw new Error('S5 lifecycle output changed across repeated deterministic runs.');
  }

  return {
    schemaVersion: '1',
    environment: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
    },
    matrix: {
      runCount: 2,
      scenarioCount: first.length,
    },
    matrixHash: sha256(stableJson(first)),
    scenarios: first,
  };
}
