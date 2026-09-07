import { once } from 'node:events';
import { createServer } from 'node:net';

import { BUDGETS, deferred } from './constants.mjs';
import { ServerHost } from './server-host-core.mjs';

function url(host, path) {
  return `http://127.0.0.1:${host.port}${path}`;
}

async function request(host, path) {
  const response = await fetch(url(host, path), {
    headers: { connection: 'close' },
    signal: AbortSignal.timeout(BUDGETS.clientRequestDeadlineMs),
  });
  await response.arrayBuffer();
  return response.status;
}

function summary(id, host, outcome, exitClassification, extras = {}) {
  return { id, ...host.snapshot(outcome, exitClassification), ...extras };
}

async function normalStartStop() {
  const host = new ServerHost();
  await host.start();
  const readyStatus = await request(host, '/health/ready');
  await host.requestStop('api');
  return summary('normal-start-stop', host, 'stopped', 'zero', { readyStatus });
}

async function listenAddressInUse() {
  const reservation = createServer();
  reservation.listen({ host: '127.0.0.1', port: 0 });
  await once(reservation, 'listening');
  const address = reservation.address();
  const host = new ServerHost();
  try {
    await host.start({ port: address.port });
    throw new Error('Address-in-use fixture unexpectedly listened.');
  } catch (error) {
    if (error?.code !== 'E_SERVER_LISTEN') throw error;
  } finally {
    reservation.close();
    await once(reservation, 'close');
  }
  return summary('listen-address-in-use', host, 'startup-failed', 'non-zero', { reservationReleased: true });
}

async function routeRegistrationFailure() {
  const host = new ServerHost({ duplicateRoute: true });
  try {
    await host.start();
    throw new Error('Duplicate-route fixture unexpectedly listened.');
  } catch (error) {
    if (error?.code !== 'E_SERVER_ROUTE_REGISTER') throw error;
  }
  return summary('route-registration-failure', host, 'startup-failed', 'non-zero');
}

async function signalSharedStop() {
  const closeGate = { entered: deferred(), release: deferred() };
  const host = new ServerHost({ closeGate });
  await host.start();
  const first = host.requestStop('SIGTERM');
  await closeGate.entered.promise;
  const second = host.requestStop('SIGINT');
  closeGate.release.resolve();
  const [firstResult, secondResult] = await Promise.all([first, second]);
  return summary('signal-shared-stop', host, 'stopped', 'zero', {
    stopPromiseShared: first === second,
    terminalResultShared: firstResult === secondResult,
  });
}

async function slowRequestDrain() {
  const slowEntered = deferred();
  const closeGate = { entered: deferred(), release: deferred() };
  const host = new ServerHost({ closeGate, onSlowEntered: () => slowEntered.resolve() });
  await host.start();
  const slowRequest = request(host, '/fixtures/slow');
  await slowEntered.promise;
  const stopping = host.requestStop('api');
  await closeGate.entered.promise;
  const closingStatus = await request(host, '/health/live');
  closeGate.release.resolve();
  host.releaseSlowRequest();
  const slowStatus = await slowRequest;
  await stopping;
  return summary('slow-request-drain', host, 'stopped', 'zero', { closingStatus, slowStatus });
}

async function requestDrainTimeout() {
  const slowEntered = deferred();
  const host = new ServerHost({ onSlowEntered: () => slowEntered.resolve() });
  await host.start();
  void request(host, '/fixtures/slow').catch(() => {});
  await slowEntered.promise;
  const result = await host.requestStop('api');
  return summary('request-drain-timeout', host, result.status, 'non-zero');
}

async function backgroundStopTimeout() {
  const backgroundGate = deferred();
  const host = new ServerHost({ backgroundGate, backgroundStuck: true });
  await host.start();
  const result = await host.requestStop('api');
  return summary('background-stop-timeout', host, result.status, 'non-zero');
}

async function repeatedConcurrentStop() {
  const closeGate = { entered: deferred(), release: deferred() };
  const host = new ServerHost({ closeGate });
  await host.start();
  const first = host.requestStop('api');
  await closeGate.entered.promise;
  const concurrent = host.requestStop('api');
  closeGate.release.resolve();
  const [firstResult, concurrentResult] = await Promise.all([first, concurrent]);
  const sequentialA = host.requestStop('api');
  const sequentialB = host.requestStop('api');
  const [afterA, afterB] = await Promise.all([sequentialA, sequentialB]);
  return summary('repeated-concurrent-stop', host, 'stopped', 'zero', {
    stopPromiseShared: first === concurrent && first === sequentialA && first === sequentialB,
    terminalResultShared: firstResult === concurrentResult && firstResult === afterA && firstResult === afterB,
  });
}

async function stopBeforeReady() {
  const beforeReadyGate = deferred();
  const listening = deferred();
  const host = new ServerHost({ beforeReadyGate, onListening: () => listening.resolve() });
  const starting = host.start();
  await listening.promise;
  const stopping = host.requestStop('api');
  beforeReadyGate.resolve();
  const [startResult] = await Promise.all([starting, stopping]);
  return summary('stop-before-ready', host, startResult.status, 'zero');
}

async function handlerFailure() {
  const host = new ServerHost();
  await host.start();
  const failureStatus = await request(host, '/fixtures/fail');
  const stateAfterFailure = host.state;
  await host.requestStop('api');
  return summary('handler-failure', host, 'stopped', 'zero', { failureStatus, stateAfterFailure });
}

const SCENARIOS = Object.freeze({
  'normal-start-stop': normalStartStop,
  'listen-address-in-use': listenAddressInUse,
  'route-registration-failure': routeRegistrationFailure,
  'signal-shared-stop': signalSharedStop,
  'slow-request-drain': slowRequestDrain,
  'request-drain-timeout': requestDrainTimeout,
  'background-stop-timeout': backgroundStopTimeout,
  'repeated-concurrent-stop': repeatedConcurrentStop,
  'stop-before-ready': stopBeforeReady,
  'handler-failure': handlerFailure,
});

export async function runScenario(id) {
  const scenario = SCENARIOS[id];
  if (scenario === undefined) throw new Error(`Unknown S6 scenario ${id}.`);
  return scenario();
}

export async function runCloseFailureFixture() {
  const host = new ServerHost({ closeFailure: true });
  await host.start();
  await host.requestStop('api');
  return summary('close-failure-unit', host, 'stopped-with-diagnostics', 'zero');
}
