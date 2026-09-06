import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { isResolutionLogicalPath } from './normalize-resolution-record.js';
import { failSourceResolution as fail } from './source-resolution-error.js';
import {
  absoluteFromLogical,
  inspectExactFile,
  isWithin,
} from './workspace-files.js';

export interface PackageManifest {
  name: string;
  exports?: unknown;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  optionalDependencies?: Record<string, unknown>;
  peerDependencies?: Record<string, unknown>;
}

export interface WorkspacePackage {
  root: string;
  absoluteRoot: string;
  manifest: PackageManifest;
}

function readPackage(workspaceRoot: string, root: string): WorkspacePackage {
  if (!isResolutionLogicalPath(root)) {
    fail('E_PACKAGE_MANIFEST_INVALID', 'workspacePackages', `Package root ${JSON.stringify(root)} is not logical.`);
  }
  const absoluteRoot = absoluteFromLogical(workspaceRoot, root);
  if (!isWithin(workspaceRoot, absoluteRoot)) {
    fail('E_PACKAGE_ESCAPE', 'workspacePackages', `Package root ${JSON.stringify(root)} escapes the workspace.`);
  }
  const manifestState = inspectExactFile(workspaceRoot, `${root}/package.json`);
  if (manifestState === 'case-mismatch') {
    fail('E_PATH_CASE_MISMATCH', 'workspacePackages', `Package root ${JSON.stringify(root)} has incorrect casing.`);
  }
  if (manifestState === 'symlink') {
    fail('E_SYMLINK_ESCAPE', 'workspacePackages', `Package root ${JSON.stringify(root)} contains a symlink.`);
  }
  if (manifestState === 'missing') {
    fail('E_PACKAGE_MANIFEST_INVALID', `${root}/package.json`, 'Package manifest does not exist.');
  }

  let manifest: PackageManifest;
  try {
    manifest = JSON.parse(readFileSync(resolve(absoluteRoot, 'package.json'), 'utf8')) as PackageManifest;
  } catch (error) {
    fail('E_PACKAGE_MANIFEST_INVALID', `${root}/package.json`, `Cannot read package manifest: ${String(error)}`);
  }
  if (typeof manifest.name !== 'string' || manifest.name.length === 0) {
    fail('E_PACKAGE_MANIFEST_INVALID', `${root}/package.json`, 'Package manifest requires a non-empty name.');
  }
  return { root, absoluteRoot, manifest };
}

export function loadWorkspacePackages(workspaceRoot: string, roots: string[]): WorkspacePackage[] {
  const packages = roots.map(root => readPackage(workspaceRoot, root));
  const names = new Set<string>();
  for (const candidate of packages) {
    if (names.has(candidate.manifest.name)) {
      fail('E_PACKAGE_MANIFEST_INVALID', 'workspacePackages', `Duplicate package ${candidate.manifest.name}.`);
    }
    names.add(candidate.manifest.name);
  }
  return packages;
}

export function ownerOf(importer: string, packages: WorkspacePackage[]): WorkspacePackage | undefined {
  return packages
    .filter(candidate => importer.startsWith(`${candidate.root}/`))
    .sort((left, right) => right.root.length - left.root.length)[0];
}

export function dependencyNames(manifest: PackageManifest): Set<string> {
  return new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);
}

export function parsePackageSpecifier(specifier: string): { identity: string; subpath: string } | undefined {
  const parts = specifier.split('/');
  const identityLength = specifier.startsWith('@') ? 2 : 1;
  if (parts.length < identityLength || parts.slice(0, identityLength).some(part => part.length === 0)) return undefined;
  const identity = parts.slice(0, identityLength).join('/');
  const rest = parts.slice(identityLength);
  return { identity, subpath: rest.length === 0 ? '.' : `./${rest.join('/')}` };
}
