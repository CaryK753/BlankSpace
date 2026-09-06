import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import Ajv2020 from 'ajv/dist/2020.js';

import { runEventDispatchMatrix } from './event-runner.mjs';

const transcriptPromise = runEventDispatchMatrix();

function scenario(transcript, id) {
  const item = transcript.scenarios.find(candidate => candidate.id === id);
  assert.ok(item, `Missing S5 Event scenario ${id}.`);
  return item;
}

test('S5 rejects publish during register, factory, start and stopping without running handlers', async () => {
  const item = scenario(await transcriptPromise, 'lifecycle-rejections');
  assert.deepEqual(item.rejections.map(diagnostic => diagnostic.phase), [
    'register', 'factory', 'start', 'stopping',
  ]);
  assert.ok(item.rejections.every(diagnostic => diagnostic.code === 'E_EVENT_PUBLISH_LIFECYCLE'));
  assert.equal(item.handlerRuns, 0);
  assert.equal(item.finalState, 'stopped');
});

test('S5 dispatches handlers by stable id and records failure without rejecting publish', async () => {
  const item = scenario(await transcriptPromise, 'stable-order-and-handler-failure');
  assert.deepEqual(item.handlerOrder, ['handler.a', 'handler.m', 'handler.z']);
  assert.equal(item.publishResolved, true);
  assert.deepEqual(item.diagnostics.map(diagnostic => [diagnostic.code, diagnostic.handlerId]), [
    ['E_EVENT_HANDLER_FAILED', 'handler.m'],
  ]);
  assert.ok(item.envelopes.every(envelope => envelope.dispatchDepth === 1));
});

test('S5 nested publish is depth-first and preserves correlation and causation', async () => {
  const item = scenario(await transcriptPromise, 'nested-depth-first');
  assert.deepEqual(item.dispatchTrace, [
    'root.a:start',
    'child.a:start',
    'leaf.a',
    'child.a:end',
    'child.z',
    'root.a:end',
    'root.z',
  ]);
  assert.deepEqual(item.envelopes.map(envelope => [
    envelope.eventInstanceId,
    envelope.correlationId,
    envelope.causationId,
    envelope.dispatchDepth,
  ]), [
    ['root-1', 'correlation-root', null, 1],
    ['child-1', 'correlation-root', 'root-1', 2],
    ['leaf-1', 'correlation-root', 'child-1', 3],
    ['child-1', 'correlation-root', 'root-1', 2],
    ['root-1', 'correlation-root', null, 1],
  ]);
  assert.deepEqual(item.diagnostics, []);
});

test('S5 rejects depth 33, records the current handler failure and continues scheduled tails', async () => {
  const item = scenario(await transcriptPromise, 'depth-limit');
  assert.deepEqual(item.recurseDepths, Array.from({ length: 32 }, (_, index) => index + 1));
  assert.deepEqual(item.tailDepths, Array.from({ length: 32 }, (_, index) => 32 - index));
  assert.equal(item.maxObservedDepth, 32);
  assert.deepEqual(item.diagnostics.map(diagnostic => [
    diagnostic.code,
    diagnostic.handlerId,
    diagnostic.dispatchDepth,
  ]), [['E_EVENT_DISPATCH_DEPTH', 'loop.a-recurse', 33]]);
});

test('S5 stop rejects new publish, drains the active dispatch, then stops entries in reverse order', async () => {
  const item = scenario(await transcriptPromise, 'active-dispatch-drain');
  assert.equal(item.stoppedBeforeHandlerRelease, false);
  assert.equal(item.rejection.code, 'E_EVENT_PUBLISH_LIFECYCLE');
  assert.equal(item.rejection.phase, 'stopping');
  assert.deepEqual(item.trace.slice(-4), ['stopping:requested', 'handler:slow:end', 'stop:B', 'stop:A']);
  assert.equal(item.finalState, 'stopped');
});

test('S5 Event dispatch matrix matches the checked-in deterministic baseline', async () => {
  const [actual, expected] = await Promise.all([
    transcriptPromise,
    readFile(new URL('./transcripts/macos-arm64-events.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  assert.equal(actual.matrixHash, expected.matrixHash);
  assert.deepEqual(actual.scenarios, expected.scenarios);
  if (process.platform === 'darwin' && process.arch === 'arm64') assert.deepEqual(actual, expected);
});

test('S5 Event dispatch transcript conforms to its frozen schema', async () => {
  const [transcript, schema] = await Promise.all([
    transcriptPromise,
    readFile(new URL('./event-transcript.schema.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  const validate = new Ajv2020({ strict: true }).compile(schema);
  assert.equal(validate(transcript), true, JSON.stringify(validate.errors));
});
