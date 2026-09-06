import { describe, expect, test } from 'vitest';

import {
  ImportPolicyError,
  enforceImportPolicy,
  type ImportBoundary,
  type ImportPolicyInput,
} from '../src/index.js';

function boundary(ownerId: string, target: ImportBoundary['target']): ImportBoundary {
  return { ownerId, target };
}

describe('enforceImportPolicy', () => {
  test.each([
    ['static', boundary('web-app', 'web'), boundary('shared-kit', 'shared')],
    ['dynamic-static', boundary('server-app', 'server'), boundary('shared-kit', 'shared')],
    ['static', boundary('web-app', 'web'), boundary('web-kit', 'web')],
    ['static', boundary('server-app', 'server'), boundary('server-kit', 'server')],
  ] as const)('accepts %s imports within compatible targets', (importKind, importer, resolved) => {
    expect(enforceImportPolicy({
      importKind,
      resolutionTarget: importer.target,
      importer,
      resolved: { kind: 'module', boundary: resolved },
    })).toEqual({ classification: 'runtime-edge' });
  });

  test.each([
    [boundary('shared', 'shared'), boundary('web', 'web'), 'E_SHARED_BOUNDARY'],
    [boundary('shared', 'shared'), boundary('server', 'server'), 'E_SHARED_BOUNDARY'],
    [boundary('web', 'web'), boundary('server', 'server'), 'E_TARGET_BOUNDARY'],
    [boundary('server', 'server'), boundary('web', 'web'), 'E_TARGET_BOUNDARY'],
  ] as const)('rejects incompatible target edges', (importer, resolved, code) => {
    expectPolicyDiagnostic({
      importKind: 'static',
      resolutionTarget: importer.target,
      importer,
      resolved: { kind: 'module', boundary: resolved },
    }, code, 'resolved.target');
  });

  test('rejects server SecretRef metadata entering web or shared', () => {
    for (const target of ['web', 'shared'] as const) {
      expectPolicyDiagnostic({
        importKind: 'static',
        resolutionTarget: target,
        importer: boundary(target, target),
        resolved: {
          kind: 'module',
          boundary: { ownerId: 'secret-config', target: 'shared', hasServerSecret: true },
        },
      }, target === 'shared' ? 'E_SHARED_BOUNDARY' : 'E_TARGET_BOUNDARY', 'resolved.hasServerSecret');
    }
  });

  test('allows Node built-ins only in server target', () => {
    expect(enforceImportPolicy({
      importKind: 'static',
      resolutionTarget: 'server',
      importer: boundary('server', 'server'),
      resolved: { kind: 'node-builtin' },
    })).toEqual({ classification: 'runtime-edge' });

    for (const target of ['web', 'shared'] as const) {
      expectPolicyDiagnostic({
        importKind: 'static',
        resolutionTarget: target,
        importer: boundary(target, target),
        resolved: { kind: 'node-builtin' },
      }, target === 'shared' ? 'E_SHARED_BOUNDARY' : 'E_TARGET_BOUNDARY', 'specifier');
    }
  });

  test('rejects a resolution target inconsistent with importer metadata', () => {
    expectPolicyDiagnostic({
      importKind: 'static',
      resolutionTarget: 'server',
      importer: boundary('web', 'web'),
      resolved: { kind: 'module', boundary: boundary('shared', 'shared') },
    }, 'E_TARGET_BOUNDARY', 'importer.target');
  });

  test('classifies same-owner opaque imports and expands affected scope', () => {
    expect(enforceImportPolicy({
      importKind: 'dynamic-opaque',
      importer: boundary('editor', 'web'),
      constrainedOwnerId: 'editor',
      constrainedTarget: 'web',
    })).toEqual({
      classification: 'opaque-owner-scope',
      affectedOwnerId: 'editor',
      affectedTarget: 'web',
    });
  });

  test.each([
    [{ constrainedOwnerId: 'other', constrainedTarget: 'web' }],
    [{ constrainedOwnerId: 'editor', constrainedTarget: 'server' }],
    [{}],
  ])('rejects cross-owner, cross-target or unconstrained opaque imports', constraint => {
    expectPolicyDiagnostic({
      importKind: 'dynamic-opaque',
      importer: boundary('editor', 'web'),
      ...constraint,
    }, 'E_DYNAMIC_IMPORT_BOUNDARY', 'importKind');
  });
});

function expectPolicyDiagnostic(input: ImportPolicyInput, code: string, path: string): void {
  try {
    enforceImportPolicy(input);
    throw new Error('Expected import policy to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(ImportPolicyError);
    expect((error as ImportPolicyError).diagnostics.map(diagnostic => [diagnostic.code, diagnostic.path]))
      .toEqual([[code, path]]);
  }
}
