import type { ResolutionTarget } from '@blankspace/contracts';

export type ImportExpressionKind = 'static' | 'dynamic-static' | 'dynamic-opaque';

export interface ImportBoundary {
  ownerId: string;
  target: ResolutionTarget;
  hasServerSecret?: boolean;
}

export type ImportPolicyDiagnosticCode =
  | 'E_TARGET_BOUNDARY'
  | 'E_SHARED_BOUNDARY'
  | 'E_DYNAMIC_IMPORT_BOUNDARY';

export interface ImportPolicyDiagnostic {
  code: ImportPolicyDiagnosticCode;
  path: string;
  message: string;
}

export class ImportPolicyError extends Error {
  readonly diagnostics: [ImportPolicyDiagnostic];

  constructor(diagnostic: ImportPolicyDiagnostic) {
    super(`${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`);
    this.name = 'ImportPolicyError';
    this.diagnostics = [diagnostic];
  }
}

export type ImportPolicyInput =
  | {
      importKind: 'static' | 'dynamic-static';
      resolutionTarget: ResolutionTarget;
      importer: ImportBoundary;
      resolved: { kind: 'module'; boundary: ImportBoundary } | { kind: 'node-builtin' };
    }
  | {
      importKind: 'dynamic-opaque';
      importer: ImportBoundary;
      constrainedOwnerId?: string;
      constrainedTarget?: ResolutionTarget;
    };

export type ImportPolicyResult =
  | { classification: 'runtime-edge' }
  | {
      classification: 'opaque-owner-scope';
      affectedOwnerId: string;
      affectedTarget: ResolutionTarget;
    };

function fail(code: ImportPolicyDiagnosticCode, path: string, message: string): never {
  throw new ImportPolicyError({ code, path, message });
}

function boundaryCode(target: ResolutionTarget): 'E_SHARED_BOUNDARY' | 'E_TARGET_BOUNDARY' {
  return target === 'shared' ? 'E_SHARED_BOUNDARY' : 'E_TARGET_BOUNDARY';
}

export function enforceImportPolicy(input: ImportPolicyInput): ImportPolicyResult {
  if (input.importKind === 'dynamic-opaque') {
    if (
      input.constrainedOwnerId !== input.importer.ownerId
      || input.constrainedTarget !== input.importer.target
    ) {
      fail(
        'E_DYNAMIC_IMPORT_BOUNDARY',
        'importKind',
        `Opaque dynamic import from ${input.importer.ownerId}/${input.importer.target} must stay in the same owner and target.`,
      );
    }
    return {
      classification: 'opaque-owner-scope',
      affectedOwnerId: input.importer.ownerId,
      affectedTarget: input.importer.target,
    };
  }

  if (input.resolutionTarget !== input.importer.target) {
    fail(
      boundaryCode(input.importer.target),
      'importer.target',
      `Resolution target ${input.resolutionTarget} does not match importer target ${input.importer.target}.`,
    );
  }

  if (input.resolved.kind === 'node-builtin') {
    if (input.importer.target !== 'server') {
      fail(
        boundaryCode(input.importer.target),
        'specifier',
        `Node built-ins cannot enter target ${input.importer.target}.`,
      );
    }
    return { classification: 'runtime-edge' };
  }

  const resolved = input.resolved.boundary;
  if (resolved.hasServerSecret && input.importer.target !== 'server') {
    fail(
      boundaryCode(input.importer.target),
      'resolved.hasServerSecret',
      `Server SecretRef owned by ${resolved.ownerId} cannot enter target ${input.importer.target}.`,
    );
  }
  if (input.importer.target === 'shared' && resolved.target !== 'shared') {
    fail(
      'E_SHARED_BOUNDARY',
      'resolved.target',
      `Shared owner ${input.importer.ownerId} cannot import ${resolved.target} owner ${resolved.ownerId}.`,
    );
  }
  if (
    input.importer.target !== 'shared'
    && resolved.target !== 'shared'
    && resolved.target !== input.importer.target
  ) {
    fail(
      'E_TARGET_BOUNDARY',
      'resolved.target',
      `${input.importer.target} owner ${input.importer.ownerId} cannot import ${resolved.target} owner ${resolved.ownerId}.`,
    );
  }
  return { classification: 'runtime-edge' };
}
