import { cp, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import {
  ImportPolicyError,
  SourceResolutionError,
  resolveSourceImport,
  type SourceResolutionInput,
} from '../src/index.js';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(testDirectory, 'fixtures/resolver-workspace');
const packageRoots = ['packages/app', 'packages/library', 'packages/hidden'];

function input(overrides: Partial<SourceResolutionInput> = {}): SourceResolutionInput {
  const target = overrides.target ?? 'web';
  return {
    workspaceRoot: fixtureRoot,
    workspacePackages: packageRoots,
    importer: 'packages/app/src/index.ts',
    specifier: '@fixture/library',
    mode: 'web-dev',
    target,
    importPolicy: overrides.importPolicy ?? {
      importKind: 'static',
      importer: { ownerId: 'app', target },
      resolved: { ownerId: 'library', target: 'shared' },
    },
    ...overrides,
  };
}

describe('resolveSourceImport', () => {
  test('resolves condition exports for type, browser and server modes', () => {
    expect(resolveSourceImport(input())).toMatchObject({
      packageIdentity: '@fixture/library',
      exportSubpath: '.',
      logicalPath: 'packages/library/src/browser.ts',
      conditions: ['browser', 'development', 'import', 'default'],
    });
    expect(resolveSourceImport(input({ mode: 'server', target: 'server' }))).toMatchObject({
      logicalPath: 'packages/library/src/node.ts',
      conditions: ['node', 'import', 'default'],
    });
    expect(resolveSourceImport(input({ mode: 'type', target: 'shared' }))).toMatchObject({
      logicalPath: 'packages/library/src/index.d.ts',
      conditions: ['types', 'import', 'default'],
    });
  });

  test('resolves explicit and wildcard public package subpaths', () => {
    expect(resolveSourceImport(input({ specifier: '@fixture/library/feature' }))).toMatchObject({
      exportSubpath: './feature',
      logicalPath: 'packages/library/src/feature.ts',
    });
    expect(resolveSourceImport(input({ specifier: '@fixture/library/features/alpha' }))).toMatchObject({
      exportSubpath: './features/alpha',
      logicalPath: 'packages/library/src/features/alpha.ts',
    });
  });

  test('preserves condition object priority and resolves nested conditions', () => {
    expect(resolveSourceImport(input({ specifier: '@fixture/library/ordered' }))).toMatchObject({
      logicalPath: 'packages/library/src/index.ts',
    });
    expect(resolveSourceImport(input({
      specifier: '@fixture/library/nested', mode: 'server', target: 'server',
    }))).toMatchObject({
      logicalPath: 'packages/library/src/node.ts',
    });
  });

  test('resolves explicit relative ESM paths and the declared .js source substitution', () => {
    expect(resolveSourceImport(input({ specifier: './helper.js' }))).toMatchObject({
      logicalPath: 'packages/app/src/helper.ts',
      format: 'esm',
    });
    expect(resolveSourceImport(input({ specifier: './data.json' }))).toMatchObject({
      logicalPath: 'packages/app/src/data.json',
      format: 'json',
    });
  });

  test('externalizes Node built-ins only for server imports', () => {
    expect(resolveSourceImport(input({
      specifier: 'node:fs', mode: 'server', target: 'server',
    }))).toMatchObject({ format: 'external', external: true });
    expectPolicyDiagnostic(input({ specifier: 'node:fs' }), 'E_TARGET_BOUNDARY');
    expectPolicyDiagnostic(input({
      specifier: 'node:fs', mode: 'type', target: 'shared',
    }), 'E_SHARED_BOUNDARY');
  });

  test('enforces resolved module target and SecretRef metadata', () => {
    expectPolicyDiagnostic(input({
      importPolicy: {
        importKind: 'dynamic-static',
        importer: { ownerId: 'app', target: 'web' },
        resolved: { ownerId: 'library', target: 'server' },
      },
    }), 'E_TARGET_BOUNDARY');
    expectPolicyDiagnostic(input({
      importPolicy: {
        importKind: 'static',
        importer: { ownerId: 'app', target: 'web' },
        resolved: { ownerId: 'library', target: 'shared', hasServerSecret: true },
      },
    }), 'E_TARGET_BOUNDARY');
  });

  test.each([
    ['@fixture/library/src/private.ts', 'E_PRIVATE_EXPORT'],
    ['@fixture/library/private/secret.ts', 'E_PRIVATE_EXPORT'],
    ['@fixture/hidden', 'E_UNDECLARED_DEPENDENCY'],
    ['@fixture/library/escape', 'E_PACKAGE_ESCAPE'],
    ['@fixture/library/bad-case', 'E_PATH_CASE_MISMATCH'],
    ['@fixture/library/types-only', 'E_RUNTIME_EXPORT_MISSING'],
    ['./helper', 'E_RELATIVE_EXTENSION_REQUIRED'],
    ['./dual.js', 'E_RESOLUTION_AMBIGUOUS'],
    ['#internal', 'E_RESOLUTION_SPECIFIER_UNSUPPORTED'],
  ])('rejects %s with %s', (specifier, code) => {
    expectDiagnostic(input({ specifier }), code);
  });

  test('rejects imports from packages that do not declare their visible dependency', () => {
    expectDiagnostic(input({
      importer: 'packages/hidden/src/index.ts',
      specifier: '@fixture/library',
    }), 'E_UNDECLARED_DEPENDENCY');
  });

  test('rejects importer casing drift before resolving the specifier', () => {
    expectDiagnostic(input({ importer: 'packages/app/src/Index.ts' }), 'E_PATH_CASE_MISMATCH');
  });

  test('does not let package registration order affect records', () => {
    const left = resolveSourceImport(input());
    const right = resolveSourceImport(input({ workspacePackages: [...packageRoots].reverse() }));

    expect(right).toEqual(left);
  });

  test('produces identical logical records in different checkout directories', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'blankspace-resolver-'));
    const leftRoot = join(temporaryRoot, 'left');
    const rightRoot = join(temporaryRoot, 'right');

    try {
      await Promise.all([
        cp(fixtureRoot, leftRoot, { recursive: true }),
        cp(fixtureRoot, rightRoot, { recursive: true }),
      ]);
      const left = resolveSourceImport(input({ workspaceRoot: leftRoot }));
      const right = resolveSourceImport(input({ workspaceRoot: rightRoot }));
      expect(right).toEqual(left);
      expect(JSON.stringify(right)).not.toContain(temporaryRoot);
    } finally {
      await rm(temporaryRoot, { recursive: true });
    }
  });

  test('rejects a symlink before it can escape a package boundary', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'blankspace-resolver-link-'));

    try {
      await cp(fixtureRoot, temporaryRoot, { recursive: true });
      await symlink('../../outside.ts', join(temporaryRoot, 'packages/library/src/link.ts'));
      expectDiagnostic(input({
        workspaceRoot: temporaryRoot,
        specifier: '@fixture/library/link',
      }), 'E_SYMLINK_ESCAPE');
    } finally {
      await rm(temporaryRoot, { recursive: true });
    }
  });
});

function expectDiagnostic(candidate: SourceResolutionInput, code: string): void {
  try {
    resolveSourceImport(candidate);
    throw new Error('Expected source resolution to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(SourceResolutionError);
    expect((error as SourceResolutionError).diagnostics.map(diagnostic => diagnostic.code)).toEqual([code]);
  }
}

function expectPolicyDiagnostic(candidate: SourceResolutionInput, code: string): void {
  try {
    resolveSourceImport(candidate);
    throw new Error('Expected import policy to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(ImportPolicyError);
    expect((error as ImportPolicyError).diagnostics.map(diagnostic => diagnostic.code)).toEqual([code]);
  }
}
