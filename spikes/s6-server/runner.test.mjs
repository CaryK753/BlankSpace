import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import Ajv2020 from 'ajv/dist/2020.js';

import { CORE_SCENARIO_IDS } from './constants.mjs';
import { runServerMatrix } from './runner.mjs';
import { runCloseFailureFixture } from './scenarios.mjs';

const transcriptPromise = runServerMatrix();

function scenario(transcript, id) {
  const item = transcript.scenarios.find(candidate => candidate.id === id);
  assert.ok(item, `Missing S6 scenario ${id}.`);
  return item;
}

test('S6 core corpus preserves the frozen order and exact tool identity', async () => {
  const transcript = await transcriptPromise;
  assert.deepEqual(transcript.scenarios.map(item => item.id), CORE_SCENARIO_IDS);
  assert.equal(transcript.environment.fastify, '5.12.3');
  assert.equal(transcript.matrix.runCount, 2);
  assert.equal(transcript.matrix.scenarioCount, 10);
});

test('S6 normal, repeated and logical-signal stops close every owner at most once', async () => {
  const transcript = await transcriptPromise;
  for (const id of ['normal-start-stop', 'signal-shared-stop', 'repeated-concurrent-stop']) {
    const item = scenario(transcript, id);
    assert.equal(item.state, 'stopped');
    assert.equal(item.serverCloseCount, 1);
    assert.deepEqual(item.entryStopCounts, { A: 1, B: 1 });
  }
  assert.equal(scenario(transcript, 'signal-shared-stop').stopPromiseShared, true);
  assert.equal(scenario(transcript, 'repeated-concurrent-stop').terminalResultShared, true);
});

test('S6 startup failures preserve stable primary diagnostics and never report ready', async () => {
  const transcript = await transcriptPromise;
  const listen = scenario(transcript, 'listen-address-in-use');
  assert.equal(listen.readyCount, 0);
  assert.equal(listen.diagnostics[0].code, 'E_SERVER_LISTEN');
  assert.equal(listen.diagnostics[0].causeCode, 'EADDRINUSE');
  assert.equal(listen.reservationReleased, true);
  assert.deepEqual(listen.entryStopCounts, { A: 1, B: 1 });
  assert.equal(listen.resourceBalance, 0);
  const route = scenario(transcript, 'route-registration-failure');
  assert.equal(route.listenCount, 0);
  assert.equal(route.diagnostics[0].code, 'E_SERVER_ROUTE_REGISTER');
  assert.equal(route.diagnostics[0].causeCode, 'FST_ERR_DUPLICATED_ROUTE');
});

test('S6 drains an admitted request, rejects closing work and times out unresolved owners', async () => {
  const transcript = await transcriptPromise;
  const drain = scenario(transcript, 'slow-request-drain');
  assert.equal(drain.closingStatus, 503);
  assert.equal(drain.slowStatus, 200);
  assert.ok(drain.trace.indexOf('request:end:request:slow-1') < drain.trace.indexOf('stop:entry:B'));

  const requestTimeout = scenario(transcript, 'request-drain-timeout');
  assert.equal(requestTimeout.exitClassification, 'non-zero');
  assert.equal(requestTimeout.activeRequestCount, 1);
  assert.equal(requestTimeout.resourceBalance, 1);
  assert.deepEqual(requestTimeout.pendingOwners, ['request:slow-1']);
  const backgroundTimeout = scenario(transcript, 'background-stop-timeout');
  assert.equal(backgroundTimeout.serverCloseCount, 1);
  assert.equal(backgroundTimeout.resourceBalance, 1);
  assert.deepEqual(backgroundTimeout.pendingOwners, ['entry:B/background:fixture']);
});

test('S6 aborts start before ready and normalizes handler and close errors', async () => {
  const transcript = await transcriptPromise;
  const aborted = scenario(transcript, 'stop-before-ready');
  assert.equal(aborted.readyCount, 0);
  assert.equal(aborted.diagnostics[0].code, 'E_SERVER_START_ABORTED');
  const handler = scenario(transcript, 'handler-failure');
  assert.equal(handler.failureStatus, 500);
  assert.equal(handler.stateAfterFailure, 'ready');
  assert.equal(handler.diagnostics[0].causeCode, 'FIXTURE_HANDLER_FAILURE');

  const close = await runCloseFailureFixture();
  assert.equal(close.state, 'stopped');
  assert.equal(close.diagnostics[0].code, 'E_SERVER_CLOSE_FAILED');
  assert.equal(close.diagnostics[0].causeCode, 'FIXTURE_CLOSE_FAILURE');
  assert.deepEqual(close.entryStopCounts, { A: 1, B: 1 });
});

test('S6 canonical diagnostics exclude volatile host and third-party details', async () => {
  const transcript = await transcriptPromise;
  const canonical = JSON.stringify(transcript.scenarios);
  for (const forbidden of ['127.0.0.1:', '/Users/', '\\Users\\', 'node_modules', 'stack']) {
    assert.equal(canonical.includes(forbidden), false, `Canonical transcript leaked ${forbidden}.`);
  }
});

test('S6 canonical scenario content matches the checked-in local baseline', async () => {
  const [actual, expected] = await Promise.all([
    transcriptPromise,
    readFile(new URL('./transcripts/macos-arm64.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  assert.equal(actual.matrixHash, expected.matrixHash);
  assert.deepEqual(actual.scenarios, expected.scenarios);
  if (process.platform === 'darwin' && process.arch === 'arm64') assert.deepEqual(actual, expected);
});

test('S6 transcript conforms to the frozen schema', async () => {
  const [transcript, schema] = await Promise.all([
    transcriptPromise,
    readFile(new URL('./transcript.schema.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  const validate = new Ajv2020({ strict: true }).compile(schema);
  assert.equal(validate(transcript), true, JSON.stringify(validate.errors));
});
