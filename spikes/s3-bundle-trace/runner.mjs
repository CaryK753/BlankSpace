import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveSourceImport } from '../../packages/compiler/dist/index.js';
import { readPnpmVersion, withFixtureMatrix } from '../s2-resolver/fixture-workspace.mjs';
import { runArtifactTrace } from './artifact-runner.mjs';
import { reconcileBundleTrace } from './reconcile.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureSource = join(here, '../../packages/compiler/test/fixtures/resolver-workspace');
const packageRoots = ['packages/app', 'packages/library', 'packages/hidden'];
const importer = 'packages/app/src/index.ts';
const conditions = ['browser', 'production', 'import', 'default'];
const vitestPackageUrl = import.meta.resolve('vitest/package.json');
const vitestRequire = createRequire(vitestPackageUrl);
const viteEntry = vitestRequire.resolve('vite');
const vitePackagePath = vitestRequire.resolve('vite/package.json');
const vite = await import(pathToFileURL(viteEntry).href);

const fixtures = [
  { id: 'public-static', specifier: '@fixture/library', importKind: 'static', expected: 'pass' },
  { id: 'public-dynamic-static', specifier: '@fixture/library/feature', importKind: 'dynamic-static', expected: 'pass' },
  { id: 'undeclared-package', specifier: '@fixture/hidden', importKind: 'static', expected: 'compiler-reject' },
  {
    id: 'web-server-secret',
    specifier: '@fixture/library',
    importKind: 'static',
    expected: 'compiler-reject',
    resolved: { ownerId: 'library', target: 'shared', hasServerSecret: true },
  },
  {
    id: 'web-server-target',
    specifier: '@fixture/library/feature',
    importKind: 'dynamic-static',
    expected: 'compiler-reject',
    resolved: { ownerId: 'library', target: 'server' },
  },
  { id: 'private-export', specifier: '@fixture/library/private/secret', importKind: 'static', expected: 'compiler-reject' },
  { id: 'package-escape', specifier: '@fixture/library/escape', importKind: 'static', expected: 'compiler-reject' },
];

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalRenderedCode(value) {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/^[ \t]*\/\/#region .*\n/gm, '')
    .replace(/^[ \t]*\/\/#endregion\n?/gm, '');
}

async function logicalPath(root, absolutePath) {
  const [realRoot, realFile] = await Promise.all([realpath(root), realpath(absolutePath)]);
  const value = relative(realRoot, realFile).split(sep).join('/');
  if (value.startsWith('../') || value === '..' || value.includes('node_modules') || value.includes('\\')) {
    throw new Error(`S3 bundle module escaped fixture workspace: ${value}`);
  }
  return value;
}

function compilerInput(root, fixture) {
  return {
    workspaceRoot: root,
    workspacePackages: packageRoots,
    importer,
    specifier: fixture.specifier,
    mode: 'web-build',
    target: 'web',
    importPolicy: {
      importKind: fixture.importKind,
      importer: { ownerId: 'app', target: 'web' },
      resolved: fixture.resolved ?? { ownerId: 'library', target: 'shared' },
    },
  };
}

function ownerFor(logical) {
  if (logical.startsWith('packages/library/')) return '@fixture/library';
  if (logical.startsWith('packages/app/')) return '@fixture/app';
  return undefined;
}

async function buildTrace(root, fixture, sourceEdge) {
  const virtualEntry = '\0blankspace-s3-entry';
  const entryCode = fixture.importKind === 'dynamic-static'
    ? `void import(${JSON.stringify(fixture.specifier)}).then(value => console.log(value));`
    : `import * as value from ${JSON.stringify(fixture.specifier)}; console.log(value);`;

  const output = await vite.build({
    root,
    configFile: false,
    mode: 'production',
    logLevel: 'silent',
    resolve: { conditions },
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: 'blankspace-s3-entry',
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
        },
      },
    },
    plugins: [{
      name: 'blankspace-s3-entry',
      enforce: 'pre',
      async resolveId(source, importingFile) {
        if (source === 'blankspace-s3-entry') return virtualEntry;
        if (importingFile !== virtualEntry || source !== fixture.specifier) return null;
        return this.resolve(source, join(root, importer), { skipSelf: true });
      },
      load(id) {
        return id === virtualEntry ? entryCode : null;
      },
    }],
  });

  const bundles = Array.isArray(output) ? output.flatMap(item => item.output) : output.output;
  const modules = [];
  for (const chunk of bundles) {
    if (chunk.type !== 'chunk') continue;
    for (const [moduleId, info] of Object.entries(chunk.modules ?? {})) {
      if (moduleId === virtualEntry || moduleId.startsWith('\0')) continue;
      const path = await logicalPath(root, moduleId.split('?', 1)[0]);
      const renderedCode = canonicalRenderedCode(info.code ?? '');
      modules.push({
        chunk: chunk.fileName,
        logicalPath: path,
        packageIdentity: ownerFor(path),
        target: 'web',
        contentHash: sha256(renderedCode),
      });
    }
  }
  modules.sort((a, b) => `${a.chunk}:${a.logicalPath}`.localeCompare(`${b.chunk}:${b.logicalPath}`));
  reconcileBundleTrace([sourceEdge], modules);
  return modules;
}

async function runFixture(root, fixture) {
  try {
    const sourceEdge = resolveSourceImport(compilerInput(root, fixture));
    if (fixture.expected !== 'pass') {
      throw new Error(`Fixture ${fixture.id} unexpectedly passed compiler validation.`);
    }
    return {
      id: fixture.id,
      expected: fixture.expected,
      result: {
        status: 'pass',
        importKind: fixture.importKind,
        sourceEdge,
        bundleModules: await buildTrace(root, fixture, sourceEdge),
      },
    };
  } catch (error) {
    if (fixture.expected !== 'compiler-reject') throw error;
    if (typeof error !== 'object' || error === null || !('diagnostics' in error)) throw error;
    const diagnostic = error.diagnostics?.[0];
    if (diagnostic === undefined) throw error;
    return {
      id: fixture.id,
      expected: fixture.expected,
      result: { status: 'compiler-reject', code: diagnostic.code, path: diagnostic.path },
    };
  }
}

async function runCheckout(root) {
  const results = [];
  for (const fixture of fixtures) results.push(await runFixture(root, fixture));
  return results;
}

export async function runBundleTraceMatrix() {
  return withFixtureMatrix(fixtureSource, async ({ sessionRoot, variants }) => {
    const runs = [];
    for (const variant of variants) {
      runs.push({
        fixtures: await runCheckout(variant.checkout),
        artifacts: await runArtifactTrace(variant.checkout),
      });
    }
    if (stableJson(runs[0]) !== stableJson(runs[1])) {
      throw new Error('S3 bundle trace changed across checkout/store variants.');
    }
    const viteVersion = JSON.parse(await readFile(vitePackagePath, 'utf8')).version;
    const traceHash = sha256(stableJson(runs[0]));
    const transcript = {
      schemaVersion: '1',
      environment: { platform: process.platform, arch: process.arch },
      tools: { node: process.versions.node, pnpm: await readPnpmVersion(), vite: viteVersion },
      matrix: { checkoutCount: variants.length, pnpmStoreCount: variants.length },
      traceHash,
      fixtures: runs[0].fixtures,
      artifacts: runs[0].artifacts,
    };
    const serialized = stableJson(transcript);
    if (serialized.includes(sessionRoot) || serialized.includes('node_modules') || serialized.includes('\\')) {
      throw new Error('Canonical S3 transcript contains a machine-specific path.');
    }
    return transcript;
  });
}

export { stableJson };
