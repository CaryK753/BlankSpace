import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import Ajv2020 from 'ajv/dist/2020.js';

import { runLifecycleMatrix } from './runner.mjs';

const transcriptPromise = runLifecycleMatrix();

function scenario(transcript, id) {
  const item = transcript.scenarios.find(candidate => candidate.id === id);
  assert.ok(item, `Missing S5 scenario ${id}.`);
  return item;
}

function assertReleasedAtMostOnce(item) {
  for (const resource of item.resources) {
    assert.ok(resource.releaseAttempts <= 1, `${item.id}/${resource.resourceId} released more than once.`);
    assert.ok(resource.releaseCount <= 1, `${item.id}/${resource.resourceId} completed release more than once.`);
  }
}

test('S5 successful lifecycle is serial, ready once, and stops in strict reverse order', async () => {
  const transcript = await transcriptPromise;
  const item = scenario(transcript, 'success');

  assert.equal(item.state, 'stopped');
  assert.equal(item.readyCount, 1);
  assert.equal(item.resourceBalance, 0);
  assert.deepEqual(item.diagnostics, []);
  assert.deepEqual(item.trace, [
    'factory:A', 'start:A', 'acquire:A:A.primary',
    'factory:B', 'start:B', 'acquire:B:B.primary',
    'factory:C', 'start:C', 'acquire:C:C.primary',
    'factory:D', 'start:D', 'acquire:D:D.primary',
    'ready', 'stopping:requested',
    'stop:D', 'release:D:D.primary',
    'stop:C', 'release:C:C.primary',
    'stop:B', 'release:B:B.primary',
    'stop:A', 'release:A:A.primary',
  ]);
  assertReleasedAtMostOnce(item);
});

test('S5 startup failures never stop the failed entry and preserve the primary error', async () => {
  const transcript = await transcriptPromise;

  const factory = scenario(transcript, 'factory-failure-c');
  assert.equal(factory.primaryError.code, 'E_C_FACTORY_FAILED');
  assert.equal(factory.readyCount, 0);
  assert.equal(factory.resourceBalance, 0);
  assert.equal(factory.trace.includes('start:C'), false);
  assert.equal(factory.trace.includes('stop:C'), false);
  assert.equal(factory.trace.includes('factory:D'), false);
  assert.deepEqual(factory.trace.slice(-4), ['stop:B', 'release:B:B.primary', 'stop:A', 'release:A:A.primary']);

  const beforeResource = scenario(transcript, 'start-failure-before-resource-c');
  assert.equal(beforeResource.primaryError.code, 'E_C_START_FAILED');
  assert.equal(beforeResource.resourceBalance, 0);
  assert.equal(beforeResource.trace.includes('acquire:C:C.primary'), false);
  assert.equal(beforeResource.trace.includes('stop:C'), false);
  assert.equal(beforeResource.trace.includes('factory:D'), false);

  const partial = scenario(transcript, 'partial-start-clean-c');
  assert.equal(partial.primaryError.code, 'E_C_START_FAILED');
  assert.equal(partial.resourceBalance, 0);
  assert.ok(partial.trace.includes('release:C:C.primary'));
  assert.equal(partial.trace.includes('stop:C'), false);
  assert.equal(partial.trace.includes('factory:D'), false);
  assertReleasedAtMostOnce(partial);
});

test('S5 partial-start cleanup failure remains diagnostic while startup error stays primary', async () => {
  const transcript = await transcriptPromise;
  const item = scenario(transcript, 'partial-start-cleanup-failure-c');

  assert.equal(item.primaryError.code, 'E_C_START_FAILED');
  assert.deepEqual(item.diagnostics.map(diagnostic => [diagnostic.code, diagnostic.entryId, diagnostic.phase]), [
    ['E_RESOURCE_RELEASE_FAILED', 'C', 'start-cleanup'],
  ]);
  assert.equal(item.resourceBalance, 1);
  assert.equal(item.trace.includes('stop:C'), false);
  assert.deepEqual(item.trace.slice(-4), ['stop:B', 'release:B:B.primary', 'stop:A', 'release:A:A.primary']);
  const residual = item.resources.find(resource => resource.resourceId === 'C.primary');
  assert.ok(residual);
  assert.equal(residual.active, true);
  assert.equal(residual.releaseAttempts, 1);
  assert.equal(residual.releaseCount, 0);
  assertReleasedAtMostOnce(item);
});

test('S5 stop errors are additive and do not prevent remaining reverse-order cleanup', async () => {
  const transcript = await transcriptPromise;
  const item = scenario(transcript, 'stop-failure-c');

  assert.equal(item.primaryError, null);
  assert.deepEqual(item.diagnostics.map(diagnostic => [diagnostic.code, diagnostic.entryId, diagnostic.phase]), [
    ['E_C_STOP_FAILED', 'C', 'stop'],
  ]);
  assert.equal(item.resourceBalance, 0);
  assert.deepEqual(item.trace.slice(-8), [
    'stop:D', 'release:D:D.primary',
    'stop:C', 'release:C:C.primary',
    'stop:B', 'release:B:B.primary',
    'stop:A', 'release:A:A.primary',
  ]);
  assertReleasedAtMostOnce(item);
});

test('S5 sequential and concurrent stop calls share one shutdown result without duplicate releases', async () => {
  const transcript = await transcriptPromise;

  for (const id of ['sequential-double-stop', 'concurrent-stop']) {
    const item = scenario(transcript, id);
    assert.equal(item.stopPromiseShared, true);
    assert.equal(item.terminalResultShared, true);
    assert.equal(item.resourceBalance, 0);
    assert.equal(item.trace.filter(entry => entry === 'stop:D').length, 1);
    assert.equal(item.trace.filter(entry => entry === 'stop:C').length, 1);
    assert.equal(item.trace.filter(entry => entry === 'stop:B').length, 1);
    assert.equal(item.trace.filter(entry => entry === 'stop:A').length, 1);
    assertReleasedAtMostOnce(item);
  }
});

test('S5 stop during bounded start prevents later entries and ready, then stops the completed current entry', async () => {
  const transcript = await transcriptPromise;
  const item = scenario(transcript, 'stop-during-start-c');

  assert.equal(item.startResult, 'stopped-before-ready');
  assert.equal(item.readyCount, 0);
  assert.equal(item.resourceBalance, 0);
  assert.equal(item.trace.includes('factory:D'), false);
  assert.equal(item.trace.includes('ready'), false);
  assert.deepEqual(item.trace.slice(-7), [
    'stopping:start-cancelled',
    'stop:C', 'release:C:C.primary',
    'stop:B', 'release:B:B.primary',
    'stop:A', 'release:A:A.primary',
  ]);
  assertReleasedAtMostOnce(item);
});

test('S5 canonical scenario content matches the checked-in baseline', async () => {
  const [actual, expected] = await Promise.all([
    transcriptPromise,
    readFile(new URL('./transcripts/macos-arm64.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);

  assert.equal(actual.matrixHash, expected.matrixHash);
  assert.deepEqual(actual.scenarios, expected.scenarios);
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    assert.deepEqual(actual, expected);
  }
});

test('S5 transcript conforms to the frozen schema', async () => {
  const [transcript, schema] = await Promise.all([
    transcriptPromise,
    readFile(new URL('./transcript.schema.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  const validate = new Ajv2020({ strict: true }).compile(schema);
  assert.equal(validate(transcript), true, JSON.stringify(validate.errors));
});
