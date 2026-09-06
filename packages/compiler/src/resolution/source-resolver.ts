import { isBuiltin } from 'node:module';
import { isAbsolute, resolve } from 'node:path';
import { dirname, extname, join, normalize } from 'node:path/posix';

import type {
  ResolutionFormat,
  ResolutionMode,
  ResolutionRecordV1,
  ResolutionTarget,
} from '@blankspace/contracts';

import {
  ImportPolicyError,
  enforceImportPolicy,
  type ImportBoundary,
} from './import-policy.js';
import {
  PackageExportsShapeError,
  resolvePackageExport,
} from './package-exports.js';
import {
  ResolutionRecordError,
  isResolutionLogicalPath,
  normalizeResolutionRecord,
  resolutionConditionsFor,
} from './normalize-resolution-record.js';
import { failSourceResolution as fail } from './source-resolution-error.js';
import {
  absoluteFromLogical,
  inspectExactFile,
  isWithin,
} from './workspace-files.js';
import {
  dependencyNames,
  loadWorkspacePackages,
  ownerOf,
  parsePackageSpecifier,
  type WorkspacePackage,
} from './workspace-packages.js';

export interface SourceResolutionInput {
  workspaceRoot: string;
  workspacePackages: string[];
  importer: string;
  specifier: string;
  mode: ResolutionMode;
  target: ResolutionTarget;
  importPolicy: SourceImportPolicy;
}

export interface SourceImportPolicy {
  importKind: 'static' | 'dynamic-static';
  importer: ImportBoundary;
  resolved?: ImportBoundary;
}


function formatFor(logicalPath: string): ResolutionFormat {
  if (logicalPath.endsWith('.json')) return 'json';
  if (/\.(?:css|wasm|svg|png|jpe?g|gif|webp)$/.test(logicalPath)) return 'asset';
  return 'esm';
}

function assertTargetPath(target: string, packageRoot: WorkspacePackage): string {
  if (!target.startsWith('./') || target.includes('\\') || target.includes('\0')) {
    fail('E_PACKAGE_ESCAPE', 'package.exports', `Export target ${JSON.stringify(target)} is not package-relative.`);
  }
  const segments = target.slice(2).split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || segment === 'node_modules')) {
    fail('E_PACKAGE_ESCAPE', 'package.exports', `Export target ${JSON.stringify(target)} contains a forbidden segment.`);
  }
  const logicalPath = join(packageRoot.root, ...segments);
  const absolutePath = absoluteFromLogical(packageRoot.absoluteRoot, segments.join('/'));
  if (!isWithin(packageRoot.absoluteRoot, absolutePath)) {
    fail('E_PACKAGE_ESCAPE', 'package.exports', `Export target ${JSON.stringify(target)} escapes its package.`);
  }
  return logicalPath;
}

function assertFile(workspaceRoot: string, logicalPath: string): void {
  const state = inspectExactFile(workspaceRoot, logicalPath);
  if (state === 'case-mismatch') {
    fail('E_PATH_CASE_MISMATCH', 'specifier', `Resolved path ${JSON.stringify(logicalPath)} has incorrect casing.`);
  }
  if (state === 'missing') {
    fail('E_RESOLUTION_NOT_FOUND', 'specifier', `Resolved path ${JSON.stringify(logicalPath)} does not exist.`);
  }
  if (state === 'symlink') {
    fail('E_SYMLINK_ESCAPE', 'specifier', `Resolved path ${JSON.stringify(logicalPath)} contains a symlink.`);
  }
}

function enforceResolvedPolicy(
  input: SourceResolutionInput,
  resolved: { kind: 'node-builtin' } | { kind: 'module'; boundary: ImportBoundary },
): void {
  enforceImportPolicy({
    importKind: input.importPolicy.importKind,
    resolutionTarget: input.target,
    importer: input.importPolicy.importer,
    resolved,
  });
}

function resolvedModuleBoundary(input: SourceResolutionInput): ImportBoundary {
  if (input.importPolicy.resolved === undefined) {
    throw new ImportPolicyError({
      code: 'E_TARGET_BOUNDARY',
      path: 'importPolicy.resolved',
      message: 'Resolved module boundary metadata is required before accepting a source edge.',
    });
  }
  return input.importPolicy.resolved;
}

function resolveRelative(input: SourceResolutionInput, workspaceRoot: string, conditions: readonly string[]): ResolutionRecordV1 {
  if (extname(input.specifier) === '') {
    fail('E_RELATIVE_EXTENSION_REQUIRED', 'specifier', `Relative specifier ${JSON.stringify(input.specifier)} needs an extension.`);
  }
  const logicalCandidate = normalize(join(dirname(input.importer), input.specifier));
  if (!isResolutionLogicalPath(logicalCandidate)) {
    fail('E_PACKAGE_ESCAPE', 'specifier', `Relative specifier ${JSON.stringify(input.specifier)} escapes the workspace.`);
  }

  const directState = inspectExactFile(workspaceRoot, logicalCandidate);
  if (directState !== 'missing' || !input.specifier.endsWith('.js')) {
    assertFile(workspaceRoot, logicalCandidate);
    return normalizeResolutionRecord({
      schemaVersion: '1', importer: input.importer, specifier: input.specifier,
      mode: input.mode, target: input.target, logicalPath: logicalCandidate,
      format: formatFor(logicalCandidate), conditions: [...conditions], external: false,
    });
  }

  const substitutions = [`${logicalCandidate.slice(0, -3)}.ts`, `${logicalCandidate.slice(0, -3)}.tsx`];
  if (substitutions.some(candidate => inspectExactFile(workspaceRoot, candidate) === 'case-mismatch')) {
    fail('E_PATH_CASE_MISMATCH', 'specifier', `Source substitution for ${JSON.stringify(input.specifier)} has incorrect casing.`);
  }
  const existing = substitutions.filter(candidate => inspectExactFile(workspaceRoot, candidate) === 'file');
  if (existing.length > 1) {
    fail('E_RESOLUTION_AMBIGUOUS', 'specifier', `Specifier ${JSON.stringify(input.specifier)} has multiple source substitutions.`);
  }
  const logicalPath = existing[0] ?? logicalCandidate;
  assertFile(workspaceRoot, logicalPath);
  return normalizeResolutionRecord({
    schemaVersion: '1', importer: input.importer, specifier: input.specifier,
    mode: input.mode, target: input.target, logicalPath, format: formatFor(logicalPath),
    conditions: [...conditions], external: false,
  });
}

function resolvePackage(
  input: SourceResolutionInput,
  workspaceRoot: string,
  packages: WorkspacePackage[],
  owner: WorkspacePackage,
  conditions: readonly string[],
): ResolutionRecordV1 {
  const parsed = parsePackageSpecifier(input.specifier);
  if (parsed === undefined) {
    fail('E_RESOLUTION_SPECIFIER_UNSUPPORTED', 'specifier', `Unsupported specifier ${JSON.stringify(input.specifier)}.`);
  }
  const targetPackage = packages.find(candidate => candidate.manifest.name === parsed.identity);
  if (targetPackage === undefined) {
    fail('E_PACKAGE_NOT_FOUND', 'specifier', `Workspace package ${JSON.stringify(parsed.identity)} is not registered.`);
  }
  if (owner.manifest.name !== parsed.identity && !dependencyNames(owner.manifest).has(parsed.identity)) {
    fail('E_UNDECLARED_DEPENDENCY', 'specifier', `Package ${owner.manifest.name} does not declare ${parsed.identity}.`);
  }
  if (targetPackage.manifest.exports === undefined) {
    fail('E_PRIVATE_EXPORT', 'specifier', `Package ${parsed.identity} does not declare exports.`);
  }

  let resolution;
  try {
    resolution = resolvePackageExport(targetPackage.manifest.exports, parsed.subpath, conditions);
  } catch (error) {
    if (error instanceof PackageExportsShapeError) {
      fail('E_PACKAGE_MANIFEST_INVALID', `${targetPackage.root}/package.json`, error.message);
    }
    throw error;
  }
  if (!resolution.matched || resolution.target === null) {
    fail('E_PRIVATE_EXPORT', 'specifier', `Subpath ${parsed.subpath} is not exported by ${parsed.identity}.`);
  }
  if (resolution.target === undefined) {
    const code = input.mode === 'type' ? 'E_RESOLUTION_NOT_FOUND' : 'E_RUNTIME_EXPORT_MISSING';
    fail(code, 'specifier', `No ${input.mode} export matches ${parsed.identity}${parsed.subpath.slice(1)}.`);
  }

  const logicalPath = assertTargetPath(resolution.target, targetPackage);
  assertFile(workspaceRoot, logicalPath);
  return normalizeResolutionRecord({
    schemaVersion: '1', importer: input.importer, specifier: input.specifier,
    mode: input.mode, target: input.target, packageIdentity: parsed.identity,
    exportSubpath: parsed.subpath, logicalPath, format: formatFor(logicalPath),
    conditions: [...conditions], external: false,
  });
}

export function resolveSourceImport(input: SourceResolutionInput): ResolutionRecordV1 {
  const conditions = resolutionConditionsFor(input.mode, input.target);
  if (conditions === undefined) {
    throw new ResolutionRecordError([{
      code: 'E_RESOLUTION_MODE_TARGET', path: 'mode',
      message: `Mode ${JSON.stringify(input.mode)} is not valid for target ${JSON.stringify(input.target)}.`,
    }]);
  }
  if (!isResolutionLogicalPath(input.importer)) {
    throw new ResolutionRecordError([{
      code: 'E_RESOLUTION_LOGICAL_PATH', path: 'importer',
      message: `importer ${JSON.stringify(input.importer)} must be a repository-relative POSIX logical path.`,
    }]);
  }

  if (!isAbsolute(input.workspaceRoot)) {
    fail('E_PACKAGE_MANIFEST_INVALID', 'workspaceRoot', 'Workspace root must be an absolute path.');
  }
  const workspaceRoot = resolve(input.workspaceRoot);
  const packages = loadWorkspacePackages(workspaceRoot, input.workspacePackages);
  assertFile(workspaceRoot, input.importer);
  const owner = ownerOf(input.importer, packages);
  if (owner === undefined) {
    fail('E_PACKAGE_MANIFEST_INVALID', 'importer', `Importer ${JSON.stringify(input.importer)} has no package owner.`);
  }
  if (isBuiltin(input.specifier)) {
    const record = normalizeResolutionRecord({
      schemaVersion: '1', importer: input.importer, specifier: input.specifier,
      mode: input.mode, target: input.target, format: 'external',
      conditions: [...conditions], external: true,
    });
    enforceResolvedPolicy(input, { kind: 'node-builtin' });
    return record;
  }
  if (input.specifier.startsWith('./') || input.specifier.startsWith('../')) {
    const record = resolveRelative(input, workspaceRoot, conditions);
    enforceResolvedPolicy(input, { kind: 'module', boundary: resolvedModuleBoundary(input) });
    return record;
  }
  if (input.specifier.startsWith('#') || input.specifier.startsWith('/') || input.specifier.includes('\\')) {
    fail('E_RESOLUTION_SPECIFIER_UNSUPPORTED', 'specifier', `Unsupported specifier ${JSON.stringify(input.specifier)}.`);
  }
  const record = resolvePackage(input, workspaceRoot, packages, owner, conditions);
  enforceResolvedPolicy(input, { kind: 'module', boundary: resolvedModuleBoundary(input) });
  return record;
}
