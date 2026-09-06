import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import Ajv2020 from 'ajv/dist/2020.js';

import { runRegistryMatrix } from './runner.mjs';

const transcriptPromise = runRegistryMatrix();

test('S4 generates one deterministic joint Graph/Registry assembly', async () => {
  const transcript = await transcriptPromise;
  assert.equal(transcript.matrix.workingDirectoryCount, 2);
  assert.equal(transcript.matrix.inputOrderCount, 2);
  assert.match(transcript.assemblyId, /^[a-f0-9]{64}$/);
  assert.match(transcript.registryHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(transcript.entryIds, [
    'product.alpha.web',
    'product.web',
    'product.zeta.web',
  ]);
  assert.equal(transcript.factoryExecutions, 0);
});

test('S4 mismatch corpus fails before factory execution', async () => {
  const transcript = await transcriptPromise;
  assert.deepEqual(
    transcript.mismatches.map(item => [item.id, item.code]),
    [
      ['missing-entry', 'E_REGISTRY_ENTRY_MISSING'],
      ['extra-entry', 'E_REGISTRY_ENTRY_EXTRA'],
      ['rewritten-owner', 'E_REGISTRY_ENTRY_MISMATCH'],
      ['rewritten-target', 'E_REGISTRY_ENTRY_MISMATCH'],
      ['rewritten-module', 'E_REGISTRY_ENTRY_MISMATCH'],
      ['rewritten-export', 'E_REGISTRY_ENTRY_MISMATCH'],
      ['assembly-mismatch', 'E_REGISTRY_ASSEMBLY_MISMATCH'],
      ['registry-order-drift', 'E_REGISTRY_ASSEMBLY_INVALID'],
      ['extra-binding', 'E_REGISTRY_BINDING_EXTRA'],
      ['extra-handler', 'E_REGISTRY_HANDLER_EXTRA'],
    ],
  );
  assert.equal(transcript.factoryExecutions, 0);
});

test('S4 canonical content matches the checked-in baseline', async () => {
  const [actual, expected] = await Promise.all([
    transcriptPromise,
    readFile(new URL('./transcripts/macos-arm64.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);

  assert.equal(actual.assemblyId, expected.assemblyId);
  assert.equal(actual.registryHash, expected.registryHash);
  assert.deepEqual(actual.entryIds, expected.entryIds);
  assert.deepEqual(actual.mismatches, expected.mismatches);
  assert.equal(actual.bindings, expected.bindings);
  assert.equal(actual.handlers, expected.handlers);
  assert.equal(actual.factoryExecutions, expected.factoryExecutions);
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    assert.deepEqual(actual, expected);
  }
});

test('S4 transcript conforms to the frozen schema', async () => {
  const [transcript, schema] = await Promise.all([
    transcriptPromise,
    readFile(new URL('./transcript.schema.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  const validate = new Ajv2020({ strict: true }).compile(schema);
  assert.equal(validate(transcript), true, JSON.stringify(validate.errors));
});
