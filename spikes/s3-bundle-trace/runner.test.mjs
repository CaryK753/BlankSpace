import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import Ajv2020 from 'ajv/dist/2020.js';

import { ArtifactTraceReconciliationError, reconcileArtifactTrace } from './artifact-reconcile.mjs';
import { BundleTraceReconciliationError, reconcileBundleTrace } from './reconcile.mjs';
import { runBundleTraceMatrix } from './runner.mjs';

const transcriptPromise = runBundleTraceMatrix();

test('S3 bundle trace reconciles legal and illegal fixtures deterministically', async () => {
  const transcript = await transcriptPromise;
  assert.equal(transcript.matrix.checkoutCount, 2);
  assert.equal(transcript.matrix.pnpmStoreCount, 2);
  assert.match(transcript.traceHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    transcript.fixtures.map(item => [item.id, item.result.status]),
    [
      ['public-static', 'pass'],
      ['public-dynamic-static', 'pass'],
      ['undeclared-package', 'compiler-reject'],
      ['web-server-secret', 'compiler-reject'],
      ['web-server-target', 'compiler-reject'],
      ['private-export', 'compiler-reject'],
      ['package-escape', 'compiler-reject'],
    ],
  );
});

test('S3 observes CSS, worker, WASM, assets and virtual modules', async () => {
  const transcript = await transcriptPromise;
  assert.deepEqual(
    transcript.artifacts.map(item => item.kind),
    ['asset', 'css', 'virtual-module', 'wasm', 'worker'],
  );
  assert.ok(transcript.artifacts.every(item => /^[a-f0-9]{64}$/.test(item.contentHash)));
});

test('legal source edges appear in final bundle modules', async () => {
  const transcript = await transcriptPromise;
  for (const fixture of transcript.fixtures.filter(item => item.result.status === 'pass')) {
    assert.ok(
      fixture.result.bundleModules.some(module => module.logicalPath === fixture.result.sourceEdge.logicalPath),
      `${fixture.id} source edge should appear in bundle trace`,
    );
  }
});

test('canonical trace matches the checked-in baseline', async () => {
  const [actual, expected] = await Promise.all([
    transcriptPromise,
    readFile(new URL('./transcripts/macos-arm64.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  assert.equal(actual.traceHash, expected.traceHash);
  assert.deepEqual(actual.fixtures, expected.fixtures);
  assert.deepEqual(actual.artifacts, expected.artifacts);
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    assert.deepEqual(actual, expected);
  }
});

test('reconciliation rejects missing and unexpected workspace modules', async () => {
  const transcript = await transcriptPromise;
  const fixture = transcript.fixtures.find(item => item.id === 'public-static');
  assert.equal(fixture.result.status, 'pass');
  const edge = fixture.result.sourceEdge;
  const module = fixture.result.bundleModules[0];

  assert.throws(
    () => reconcileBundleTrace([edge], []),
    error => error instanceof BundleTraceReconciliationError
      && error.code === 'E_BUNDLE_MODULE_MISSING'
      && error.path === 'bundleModules',
  );
  assert.throws(
    () => reconcileBundleTrace([], [module]),
    error => error instanceof BundleTraceReconciliationError
      && error.code === 'E_BUNDLE_MODULE_EXTRA'
      && error.path === 'bundleModules',
  );
});

test('artifact reconciliation rejects missing and unexpected outputs', async () => {
  const transcript = await transcriptPromise;
  const artifact = transcript.artifacts[0];
  assert.throws(
    () => reconcileArtifactTrace([artifact], []),
    error => error instanceof ArtifactTraceReconciliationError
      && error.code === 'E_BUNDLE_ARTIFACT_MISSING'
      && error.path === 'artifacts',
  );
  assert.throws(
    () => reconcileArtifactTrace([], [artifact]),
    error => error instanceof ArtifactTraceReconciliationError
      && error.code === 'E_BUNDLE_ARTIFACT_EXTRA'
      && error.path === 'artifacts',
  );
});

test('canonical S3 transcript conforms to frozen schema', async () => {
  const [transcript, schema, artifactSchema, recordSchema, sharedSchema] = await Promise.all([
    transcriptPromise,
    readFile(new URL('./trace.schema.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('./artifact.schema.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../../packages/contracts/schemas/resolution-record-v1.schema.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../../packages/contracts/schemas/shared.schema.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  const ajv = new Ajv2020({ strict: true });
  ajv.addSchema(sharedSchema);
  ajv.addSchema(recordSchema);
  ajv.addSchema(artifactSchema);
  const validate = ajv.compile(schema);
  assert.equal(validate(transcript), true, JSON.stringify(validate.errors));
});
