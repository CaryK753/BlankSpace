import type {
  ProductGraphEntryV1,
  ProductGraphEventBindingV1,
  ProductGraphModuleV1,
  ProductGraphServiceBindingV1,
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

export interface MinimalProductServiceBindingInput {
  serviceId: string;
  providerId: string;
  entryId: string;
}

export interface MinimalProductEventBindingInput {
  eventId: string;
  handlerId: string;
  entryId: string;
}

export interface MinimalProductGraphInput {
  frameworkVersion: string;
  config: MinimalProductConfigInput;
  manifest: MinimalProductManifestInput;
  modules: MinimalProductModuleInput[];
  services?: MinimalProductServiceBindingInput[];
  events?: MinimalProductEventBindingInput[];
}

export interface MinimalGraphDiagnostic {
  code:
    | 'E_ENTRY_PATH_INVALID'
    | 'E_MODULE_ID_DUPLICATE'
    | 'E_TARGET_ENTRY_MISSING'
    | 'E_SERVICE_BINDING_ENTRY_MISSING'
    | 'E_SERVICE_BINDING_DUPLICATE'
    | 'E_EVENT_HANDLER_ENTRY_MISSING'
    | 'E_EVENT_HANDLER_DUPLICATE';
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

function serviceKey(binding: MinimalProductServiceBindingInput | ProductGraphServiceBindingV1): string {
  return `${binding.serviceId}:${binding.providerId}:${binding.entryId}`;
}

function eventKey(binding: MinimalProductEventBindingInput | ProductGraphEventBindingV1): string {
  return `${binding.handlerId}:${binding.eventId}:${binding.entryId}`;
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
    services: [...(input.services ?? [])]
      .sort((left, right) => serviceKey(left).localeCompare(serviceKey(right)))
      .map(binding => ({ ...binding })),
    events: [...(input.events ?? [])]
      .sort((left, right) => eventKey(left).localeCompare(eventKey(right)))
      .map(binding => ({ ...binding })),
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

function entryTargets(input: MinimalProductGraphInput, targets: readonly RuntimeTarget[]): Map<string, RuntimeTarget> {
  const map = new Map<string, RuntimeTarget>();
  for (const target of targets) {
    for (const entry of entriesForTarget(input, target)) map.set(entry.entryId, target);
  }
  return map;
}

function servicesForTarget(
  input: MinimalProductGraphInput,
  target: RuntimeTarget,
  targetByEntry: ReadonlyMap<string, RuntimeTarget>,
): ProductGraphServiceBindingV1[] {
  return (input.services ?? [])
    .filter(binding => targetByEntry.get(binding.entryId) === target)
    .map(binding => ({ ...binding }))
    .sort((left, right) => serviceKey(left).localeCompare(serviceKey(right)));
}

function eventsForTarget(
  input: MinimalProductGraphInput,
  target: RuntimeTarget,
  targetByEntry: ReadonlyMap<string, RuntimeTarget>,
): ProductGraphEventBindingV1[] {
  return (input.events ?? [])
    .filter(binding => targetByEntry.get(binding.entryId) === target)
    .map(binding => ({ ...binding }))
    .sort((left, right) => eventKey(left).localeCompare(eventKey(right)));
}

function validateBindings(
  input: MinimalProductGraphInput,
  targetByEntry: ReadonlyMap<string, RuntimeTarget>,
  diagnostics: MinimalGraphDiagnostic[],
): void {
  const serviceIdsByTarget = new Set<string>();
  for (const [index, binding] of (input.services ?? []).entries()) {
    const target = targetByEntry.get(binding.entryId);
    if (target === undefined) {
      diagnostics.push({
        code: 'E_SERVICE_BINDING_ENTRY_MISSING',
        path: `services.${index}.entryId`,
        message: `Service binding references unknown or disabled entry ${JSON.stringify(binding.entryId)}.`,
      });
      continue;
    }
    const key = `${target}:${binding.serviceId}`;
    if (serviceIdsByTarget.has(key)) {
      diagnostics.push({
        code: 'E_SERVICE_BINDING_DUPLICATE',
        path: `services.${binding.serviceId}`,
        message: `Service ${JSON.stringify(binding.serviceId)} has more than one provider binding for target ${target}.`,
      });
    }
    serviceIdsByTarget.add(key);
  }

  const handlerIdsByTarget = new Set<string>();
  for (const [index, binding] of (input.events ?? []).entries()) {
    const target = targetByEntry.get(binding.entryId);
    if (target === undefined) {
      diagnostics.push({
        code: 'E_EVENT_HANDLER_ENTRY_MISSING',
        path: `events.${index}.entryId`,
        message: `Event handler references unknown or disabled entry ${JSON.stringify(binding.entryId)}.`,
      });
      continue;
    }
    const key = `${target}:${binding.handlerId}`;
    if (handlerIdsByTarget.has(key)) {
      diagnostics.push({
        code: 'E_EVENT_HANDLER_DUPLICATE',
        path: `events.${binding.handlerId}`,
        message: `Handler ${JSON.stringify(binding.handlerId)} is declared more than once for target ${target}.`,
      });
    }
    handlerIdsByTarget.add(key);
  }
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

  const targetByEntry = entryTargets(input, targets);
  validateBindings(input, targetByEntry, diagnostics);

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
      services: servicesForTarget(input, target, targetByEntry),
      events: eventsForTarget(input, target, targetByEntry),
      diagnostics: [],
    } satisfies Omit<ProductGraphV1, 'assemblyId'>;
    const assemblyId = hashCanonical(graphWithoutAssembly as unknown as JsonValue);
    return { ...graphWithoutAssembly, assemblyId };
  });
}
