import type {
  ExecutableRegistryEntryV1,
  ExecutableRegistryV1,
  ProductGraphEntryV1,
  ProductGraphV1,
} from '@blankspace/contracts';

import { hashCanonical, type JsonValue } from '../config/jsonc.js';

const REGISTRY_SCHEMA = 'https://blankspace.dev/schemas/executable-registry-v1.schema.json';

export type ExecutableRegistryDiagnosticCode =
  | 'E_REGISTRY_ENTRY_DUPLICATE'
  | 'E_REGISTRY_ENTRY_MISSING'
  | 'E_REGISTRY_ENTRY_EXTRA'
  | 'E_REGISTRY_ENTRY_MISMATCH'
  | 'E_REGISTRY_TARGET_MISMATCH'
  | 'E_REGISTRY_ASSEMBLY_MISMATCH'
  | 'E_REGISTRY_ASSEMBLY_INVALID'
  | 'E_REGISTRY_BINDING_EXTRA'
  | 'E_REGISTRY_HANDLER_EXTRA';

export interface ExecutableRegistryDiagnostic {
  code: ExecutableRegistryDiagnosticCode;
  path: string;
  message: string;
}

export class ExecutableRegistryError extends Error {
  readonly diagnostics: [ExecutableRegistryDiagnostic];

  constructor(diagnostic: ExecutableRegistryDiagnostic) {
    super(`${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`);
    this.name = 'ExecutableRegistryError';
    this.diagnostics = [diagnostic];
  }
}

export interface ExecutableRegistryAssembly {
  graph: ProductGraphV1;
  registry: ExecutableRegistryV1;
}

function fail(code: ExecutableRegistryDiagnosticCode, path: string, message: string): never {
  throw new ExecutableRegistryError({ code, path, message });
}

function entryKey(entry: ProductGraphEntryV1 | ExecutableRegistryEntryV1): string {
  return entry.entryId;
}

function normalizeEntries(entries: readonly ProductGraphEntryV1[]): ProductGraphEntryV1[] {
  const normalized = [...entries].sort((left, right) => entryKey(left).localeCompare(entryKey(right)));
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index - 1]?.entryId === normalized[index]?.entryId) {
      fail('E_REGISTRY_ENTRY_DUPLICATE', 'entries', `Duplicate entry ${JSON.stringify(normalized[index]?.entryId)}.`);
    }
  }
  return normalized;
}

function normalizeGraph(graph: ProductGraphV1): ProductGraphV1 {
  const entries = normalizeEntries(graph.entries);
  for (const entry of entries) {
    if (entry.target !== graph.target) {
      fail(
        'E_REGISTRY_TARGET_MISMATCH',
        `entries.${entry.entryId}.target`,
        `Entry target ${entry.target} does not match graph target ${graph.target}.`,
      );
    }
  }
  return {
    ...graph,
    modules: [...graph.modules].sort((left, right) => left.id.localeCompare(right.id)),
    entries,
    diagnostics: [...graph.diagnostics].sort((left, right) =>
      `${left.code}:${left.message}`.localeCompare(`${right.code}:${right.message}`)),
  };
}

function registryEntries(graph: ProductGraphV1): ExecutableRegistryEntryV1[] {
  return graph.entries.map(entry => ({
    entryId: entry.entryId,
    ownerId: entry.ownerId,
    target: entry.target,
    module: entry.module,
    exportName: entry.exportName,
  }));
}

function registryWithoutAssembly(graph: ProductGraphV1): Omit<ExecutableRegistryV1, 'assemblyId'> {
  return {
    $schema: REGISTRY_SCHEMA,
    schemaVersion: '1',
    frameworkVersion: graph.frameworkVersion,
    target: graph.target,
    entries: registryEntries(graph),
    bindings: [],
    handlers: [],
  };
}

function graphWithoutAssembly(graph: ProductGraphV1): Omit<ProductGraphV1, 'assemblyId'> {
  const { assemblyId: _assemblyId, ...rest } = graph;
  return rest;
}

function registryValueWithoutAssembly(registry: ExecutableRegistryV1): Omit<ExecutableRegistryV1, 'assemblyId'> {
  const { assemblyId: _assemblyId, ...rest } = registry;
  return rest;
}

function jointAssemblyId(
  graph: ProductGraphV1,
  registry: Omit<ExecutableRegistryV1, 'assemblyId'>,
): string {
  return hashCanonical({
    graph: graphWithoutAssembly(graph),
    registry,
  } as unknown as JsonValue);
}

export function buildExecutableRegistry(graphInput: ProductGraphV1): ExecutableRegistryAssembly {
  const normalizedGraph = normalizeGraph(graphInput);
  const descriptor = registryWithoutAssembly(normalizedGraph);
  const assemblyId = jointAssemblyId(normalizedGraph, descriptor);
  const graph = { ...normalizedGraph, assemblyId };
  const registry: ExecutableRegistryV1 = { ...descriptor, assemblyId };
  return { graph, registry };
}

function assertUniqueRegistryEntries(entries: readonly ExecutableRegistryEntryV1[]): void {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.entryId)) {
      fail('E_REGISTRY_ENTRY_DUPLICATE', 'registry.entries', `Duplicate entry ${JSON.stringify(entry.entryId)}.`);
    }
    ids.add(entry.entryId);
  }
}

export function verifyExecutableRegistry(graphInput: ProductGraphV1, registry: ExecutableRegistryV1): void {
  const graph = normalizeGraph(graphInput);
  if (graph.assemblyId !== registry.assemblyId) {
    fail(
      'E_REGISTRY_ASSEMBLY_MISMATCH',
      'assemblyId',
      `Graph assemblyId ${graph.assemblyId} does not match Registry assemblyId ${registry.assemblyId}.`,
    );
  }
  if (registry.target !== graph.target) {
    fail('E_REGISTRY_TARGET_MISMATCH', 'registry.target', `Registry target ${registry.target} does not match graph target ${graph.target}.`);
  }
  assertUniqueRegistryEntries(registry.entries);

  const expectedById = new Map(registryEntries(graph).map(entry => [entry.entryId, entry]));
  const actualById = new Map(registry.entries.map(entry => [entry.entryId, entry]));
  const missing = [...expectedById.keys()].filter(id => !actualById.has(id)).sort();
  if (missing.length > 0) {
    fail('E_REGISTRY_ENTRY_MISSING', 'registry.entries', `Missing Registry entries: ${missing.join(', ')}.`);
  }
  const extra = [...actualById.keys()].filter(id => !expectedById.has(id)).sort();
  if (extra.length > 0) {
    fail('E_REGISTRY_ENTRY_EXTRA', 'registry.entries', `Unexpected Registry entries: ${extra.join(', ')}.`);
  }

  for (const [entryId, expected] of expectedById) {
    const actual = actualById.get(entryId);
    if (actual === undefined) continue;
    for (const field of ['ownerId', 'target', 'module', 'exportName'] as const) {
      if (actual[field] !== expected[field]) {
        fail(
          'E_REGISTRY_ENTRY_MISMATCH',
          `registry.entries.${entryId}.${field}`,
          `Expected ${JSON.stringify(expected[field])}, received ${JSON.stringify(actual[field])}.`,
        );
      }
    }
  }

  if (registry.bindings.length > 0) {
    fail('E_REGISTRY_BINDING_EXTRA', 'registry.bindings', 'Minimal ProductGraphV1 does not declare Service bindings yet.');
  }
  if (registry.handlers.length > 0) {
    fail('E_REGISTRY_HANDLER_EXTRA', 'registry.handlers', 'Minimal ProductGraphV1 does not declare Event handlers yet.');
  }

  const descriptor = registryWithoutAssembly(graph);
  const expectedAssemblyId = jointAssemblyId(graph, descriptor);
  if (graph.assemblyId !== expectedAssemblyId) {
    fail(
      'E_REGISTRY_ASSEMBLY_INVALID',
      'assemblyId',
      `Embedded assemblyId ${graph.assemblyId} does not match canonical joint assembly ${expectedAssemblyId}.`,
    );
  }

  const actualRegistryAssemblyId = jointAssemblyId(graph, registryValueWithoutAssembly(registry));
  if (registry.assemblyId !== actualRegistryAssemblyId) {
    fail(
      'E_REGISTRY_ASSEMBLY_INVALID',
      'registry.assemblyId',
      `Registry assemblyId ${registry.assemblyId} does not match its canonical joint assembly ${actualRegistryAssemblyId}.`,
    );
  }
}
