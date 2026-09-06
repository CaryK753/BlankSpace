import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import Ajv2020 from 'ajv/dist/2020.js';

import {
  TestResolutionDriftError,
  runConformanceMatrix,
  runVitestAliasDriftProbe,
  stableJson,
} from './conformance-matrix.mjs';

const transcriptPromise = runConformanceMatrix();

test('native tool adapters reconcile across two checkouts and pnpm stores', async () => {
  const transcript = await transcriptPromise;

  assert.equal(transcript.matrix.checkoutCount, 2);
  assert.equal(transcript.matrix.pnpmStoreCount, 2);
  assert.deepEqual(
    [...new Set(transcript.edges.map(edge => edge.record.mode))].sort(),
    ['server', 'test', 'type', 'web-build', 'web-dev'],
  );
  assert.deepEqual(
    [...new Set(transcript.edges.map(edge => edge.adapter))].sort(),
    ['node', 'typescript', 'vite', 'vitest'],
  );
  assert.match(transcript.recordsHash, /^[a-f0-9]{64}$/);
});

test('native records match the checked-in cross-platform baseline', async () => {
  const expected = JSON.parse(await readFile(
    new URL('./transcripts/macos-arm64.json', import.meta.url),
    'utf8',
  ));
  const actual = await transcriptPromise;

  assert.equal(actual.recordsHash, expected.recordsHash);
  assert.deepEqual(actual.edges, expected.edges);
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    assert.equal(stableJson(actual), stableJson(expected));
  }
});

test('canonical transcript conforms to its frozen schema', async () => {
  const [transcript, transcriptSchema, recordSchema, sharedSchema] = await Promise.all([
    transcriptPromise,
    readFile(new URL('./transcript.schema.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../../packages/contracts/schemas/resolution-record-v1.schema.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../../packages/contracts/schemas/shared.schema.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  const ajv = new Ajv2020({ strict: true });
  ajv.addSchema(sharedSchema);
  ajv.addSchema(recordSchema);
  const validate = ajv.compile(transcriptSchema);

  assert.equal(validate(transcript), true, JSON.stringify(validate.errors));
});

test('Vitest public-entry alias fails with E_TEST_RESOLUTION_DRIFT', async () => {
  await assert.rejects(runVitestAliasDriftProbe(), error => {
    assert.ok(error instanceof TestResolutionDriftError);
    assert.equal(error.code, 'E_TEST_RESOLUTION_DRIFT');
    assert.equal(error.path, 'test.resolve');
    return true;
  });
});
