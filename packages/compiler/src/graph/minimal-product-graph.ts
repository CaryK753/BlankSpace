import type {
  ProductGraphEntryV1,
  ProductGraphModuleV1,
  ProductGraphV1,
  RuntimeTarget,
} from '@blankspace/contracts';

import { hashCanonical, type JsonObject, type JsonValue } from '../config/jsonc.js';

const GRAPH_SCHEMA = 'https://blankspace.dev/schemas/product-graph-v1.schema.json';
const RELATIVE_PATH = /^\.\/(?!\.\.?(?:\/|$))(?!.*\/\.\.?(?:\/|$))[^\0\\]+$/;
const TARGETS: RuntimeTarget[] = ['server', 'web'];

export interface MinimalProductConfigInput {
  schemaVersion: '1';
  product: string;
  targets: RuntimeTarget[];
}

export interface MinimalProductManifestInput {
  schemaVersion: '1';
  entries?: Partial<Record<RuntimeTarget, string>>;
}

export interface MinimalProductModuleInput {
  id: string;
  descriptor: string;
  entries: Partial<Record<RuntimeTarget, string>>;
}

export interface MinimalProductGraphInput {
  frameworkVersion: string;
  config: MinimalProductConfigInput;
  manifest: MinimalProductManifestInput;
  modules: MinimalProductModuleInput[];
}

export interface MinimalGraphDiagnostic {
  code: 'E_ENTRY_PATH_INVALID' | 'E_MODULE_ID_DUPLICATE' | 'E_TARGET_ENTRY_MISSING';
  message: string;
  path: string;
}

export class ProductGraphBuildError extends Error {
  readonly diagnostics: MinimalGraphDiagnostic[];

  constructor(diagnostics: MinimalGraphDiagnostic[]) {
    super(diagnostics.map(diagnostic => `${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`).join('\n'));
    this.name = 'ProductGraphBuildError';
    this.diagnostics = diagnostics;
  }
}

function validatePath(path: string | undefined, location: string, diagnostics: MinimalGraphDiagnostic[]): void {
  if (path !== undefined && !RELATIVE_PATH.test(path)) {
    diagnostics.push({
      code: 'E_ENTRY_PATH_INVALID',
      path: location,
      message: 'Entry must be a non-empty product-relative path without parent traversal or backslashes.',
    });
  }
}

function normalizeInput(input: MinimalProductGraphInput): JsonObject {
  const modules = [...input.modules]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(module => ({
      id: module.id,
      descriptor: module.descriptor,
      entries: Object.fromEntries(
        TARGETS.flatMap(target => module.entries[target] === undefined ? [] : [[target, module.entries[target]]]),
      ),
    }));

  return {
    frameworkVersion: input.frameworkVersion,
    config: {
      schemaVersion: input.config.schemaVersion,
      product: input.config.product,
      targets: [...new Set(input.config.targets)].sort(),
    },
    manifest: {
      schemaVersion: input.manifest.schemaVersion,
      entries: Object.fromEntries(
        TARGETS.flatMap(target => input.manifest.entries?.[target] === undefined
          ? []
          : [[target, input.manifest.entries[target]]]),
      ),
    },
    modules,
  } as JsonObject;
}

function entriesForTarget(input: MinimalProductGraphInput, target: RuntimeTarget): ProductGraphEntryV1[] {
  const entries: ProductGraphEntryV1[] = [];
  const productEntry = input.manifest.entries?.[target];
  if (productEntry !== undefined) {
    entries.push({
      entryId: `product.${target}`,
      ownerId: 'product',
      target,
      module: productEntry,
      exportName: 'default',
    });
  }

  for (const module of input.modules) {
    const moduleEntry = module.entries[target];
    if (moduleEntry === undefined) continue;
    entries.push({
      entryId: `product.${module.id}.${target}`,
      ownerId: module.id,
      target,
      module: moduleEntry,
      exportName: 'default',
    });
  }

  return entries.sort((left, right) => left.entryId.localeCompare(right.entryId));
}

export function buildMinimalProductGraphs(input: MinimalProductGraphInput): ProductGraphV1[] {
  const diagnostics: MinimalGraphDiagnostic[] = [];
  const moduleIds = new Set<string>();

  for (const module of input.modules) {
    if (moduleIds.has(module.id)) {
      diagnostics.push({
        code: 'E_MODULE_ID_DUPLICATE',
        path: `modules.${module.id}`,
        message: `Module ID ${JSON.stringify(module.id)} is declared more than once.`,
      });
    }
    moduleIds.add(module.id);
    validatePath(module.descriptor, `modules.${module.id}.descriptor`, diagnostics);
    for (const target of TARGETS) validatePath(module.entries[target], `modules.${module.id}.entries.${target}`, diagnostics);
  }
  for (const target of TARGETS) validatePath(input.manifest.entries?.[target], `manifest.entries.${target}`, diagnostics);

  const targets = [...new Set(input.config.targets)].sort() as RuntimeTarget[];
  for (const target of targets) {
    if (entriesForTarget(input, target).length === 0) {
      diagnostics.push({
        code: 'E_TARGET_ENTRY_MISSING',
        path: `config.targets.${target}`,
        message: `Target ${JSON.stringify(target)} has no product or module entry.`,
      });
    }
  }

  if (diagnostics.length > 0) {
    diagnostics.sort((left, right) => `${left.code}:${left.path}`.localeCompare(`${right.code}:${right.path}`));
    throw new ProductGraphBuildError(diagnostics);
  }

  const normalizedInput = normalizeInput(input);
  const inputHash = hashCanonical(normalizedInput);
  const modules: ProductGraphModuleV1[] = [...input.modules]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(module => ({ id: module.id, descriptor: module.descriptor }));

  return targets.map(target => {
    const graphWithoutAssembly = {
      $schema: GRAPH_SCHEMA,
      schemaVersion: '1',
      frameworkVersion: input.frameworkVersion,
      target,
      inputHash,
      modules,
      entries: entriesForTarget(input, target),
      diagnostics: [],
    } satisfies Omit<ProductGraphV1, 'assemblyId'>;
    const assemblyId = hashCanonical(graphWithoutAssembly as unknown as JsonValue);
    return { ...graphWithoutAssembly, assemblyId };
  });
}
