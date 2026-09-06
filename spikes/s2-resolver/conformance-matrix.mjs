import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveSourceImport } from '../../packages/compiler/dist/index.js';
import { readPnpmVersion, withFixtureMatrix } from './fixture-workspace.mjs';
import {
  createToolAdapters,
  logicalPathFromNative,
  traceVitestWithAlias,
} from './tool-adapters.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureSource = join(here, '../../packages/compiler/test/fixtures/resolver-workspace');
const packageRoots = ['packages/app', 'packages/library', 'packages/hidden'];
const importer = 'packages/app/src/index.ts';
const modeInputs = [
  { mode: 'type', target: 'shared', tool: 'typescript' },
  { mode: 'web-dev', target: 'web', tool: 'vite' },
  { mode: 'web-build', target: 'web', tool: 'vite' },
  { mode: 'server', target: 'server', tool: 'node' },
  { mode: 'test', target: 'web', tool: 'vitest' },
];
const modeConditions = {
  type: ['types', 'import', 'default'],
  'web-dev': ['browser', 'development', 'import', 'default'],
  'web-build': ['browser', 'production', 'import', 'default'],
  server: ['node', 'import', 'default'],
  test: ['browser', 'test', 'import', 'default'],
};
const fixtures = [
  { id: 'package-root', specifier: '@fixture/library' },
  { id: 'public-subpath', specifier: '@fixture/library/feature' },
];

function compilerInput(root, specifier, modeInput) {
  return {
    workspaceRoot: root,
    workspacePackages: packageRoots,
    importer,
    specifier,
    mode: modeInput.mode,
    target: modeInput.target,
    importPolicy: {
      importKind: 'static',
      importer: { ownerId: 'app', target: modeInput.target },
      resolved: { ownerId: 'library', target: 'shared' },
    },
  };
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
  }
}

export class TestResolutionDriftError extends Error {
  constructor(expected, actual) {
    super(`E_TEST_RESOLUTION_DRIFT test.resolve: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
    this.name = 'TestResolutionDriftError';
    this.code = 'E_TEST_RESOLUTION_DRIFT';
    this.path = 'test.resolve';
  }
}

function assertToolResolution(record, native, logicalPath, label) {
  assertEqual(native.conditions.join(','), record.conditions.join(','), `${label} conditions`);
  if (logicalPath !== record.logicalPath) {
    if (record.mode === 'test') throw new TestResolutionDriftError(record.logicalPath, logicalPath);
    assertEqual(logicalPath, record.logicalPath, `${label} logical path`);
  }
}

async function runCheckout(root) {
  const adapters = await createToolAdapters(root, modeConditions);
  const absoluteImporter = join(root, importer);
  const edges = [];

  try {
    for (const fixture of fixtures) {
      for (const modeInput of modeInputs) {
        const record = resolveSourceImport(compilerInput(root, fixture.specifier, modeInput));
        const native = await adapters.resolve(modeInput.mode, fixture.specifier, absoluteImporter);
        const logicalPath = await logicalPathFromNative(root, native.resolvedId);
        assertEqual(native.tool, modeInput.tool, `${fixture.id}/${modeInput.mode} tool`);
        assertToolResolution(record, native, logicalPath, `${fixture.id}/${modeInput.mode}`);
        edges.push({ fixture: fixture.id, adapter: native.tool, record });
      }
    }

    const modeInput = modeInputs.find(candidate => candidate.mode === 'server');
    const record = resolveSourceImport({
      ...compilerInput(root, 'node:fs', modeInput),
      importPolicy: { importKind: 'static', importer: { ownerId: 'app', target: 'server' } },
    });
    const native = await adapters.resolve('server', 'node:fs', absoluteImporter);
    assertEqual(native.resolvedId, 'node:fs', 'node-builtin/server native result');
    assertEqual(record.external, true, 'node-builtin/server externalization');
    edges.push({ fixture: 'node-builtin', adapter: native.tool, record });
  } finally {
    await adapters.close();
  }

  return { edges, versions: adapters.versions };
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function runConformanceMatrix() {
  return withFixtureMatrix(fixtureSource, async ({ sessionRoot, variants }) => {
    const runs = [];
    for (const variant of variants) runs.push(await runCheckout(variant.checkout));
    assertEqual(stableJson(runs[1].edges), stableJson(runs[0].edges), 'checkout/store matrix');
    assertEqual(stableJson(runs[1].versions), stableJson(runs[0].versions), 'tool versions');

    const pnpm = await readPnpmVersion();
    const recordsHash = createHash('sha256').update(stableJson(runs[0].edges)).digest('hex');
    const transcript = {
      $schema: '../transcript.schema.json',
      schemaVersion: '1',
      environment: { platform: process.platform, arch: process.arch },
      tools: { ...runs[0].versions, pnpm },
      matrix: { checkoutCount: variants.length, pnpmStoreCount: variants.length },
      recordsHash,
      edges: runs[0].edges,
    };
    const serialized = stableJson(transcript);
    if (serialized.includes(sessionRoot) || serialized.includes('node_modules') || serialized.includes('\\')) {
      throw new Error('Canonical transcript contains a machine-specific path.');
    }
    return transcript;
  });
}

export async function runVitestAliasDriftProbe() {
  return withFixtureMatrix(fixtureSource, async ({ variants }) => {
    const root = variants[0].checkout;
    const modeInput = modeInputs.find(candidate => candidate.mode === 'test');
    const record = resolveSourceImport(compilerInput(root, '@fixture/library', modeInput));
    const native = await traceVitestWithAlias(
      root,
      '@fixture/library',
      join(root, importer),
      modeConditions.test,
      join(root, 'packages/app/src/helper.ts'),
    );
    const logicalPath = await logicalPathFromNative(root, native.resolvedId);
    assertToolResolution(record, native, logicalPath, 'test-alias-drift');
  });
}

export { stableJson };
