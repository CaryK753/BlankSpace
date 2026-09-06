import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  ExecutableRegistryError,
  buildExecutableRegistry,
  buildMinimalProductGraphs,
  verifyExecutableRegistry,
  type MinimalProductGraphInput,
} from '../src/index.js';

function input(): MinimalProductGraphInput {
  return {
    frameworkVersion: '0.0.0',
    config: {
      schemaVersion: '1',
      product: './product',
      targets: ['web'],
    },
    manifest: {
      schemaVersion: '1',
      entries: { web: './product/frontend/index.js' },
    },
    modules: [
      {
        id: 'zeta',
        descriptor: './product/modules/zeta/module.jsonc',
        entries: { web: './product/modules/zeta/frontend/index.js' },
      },
      {
        id: 'alpha',
        descriptor: './product/modules/alpha/module.jsonc',
        entries: { web: './product/modules/alpha/frontend/index.js' },
      },
    ],
  };
}

function graph() {
  return buildMinimalProductGraphs(input())[0]!;
}

function graphWithBindings() {
  const candidate = input();
  candidate.services = [
    { serviceId: 'service.search', providerId: 'zeta', entryId: 'product.zeta.web' },
    { serviceId: 'service.clock', providerId: 'alpha', entryId: 'product.alpha.web' },
  ];
  candidate.events = [
    { eventId: 'event.updated', handlerId: 'handler.zeta-updated', entryId: 'product.zeta.web' },
    { eventId: 'event.tick', handlerId: 'handler.alpha-tick', entryId: 'product.alpha.web' },
  ];
  return buildMinimalProductGraphs(candidate)[0]!;
}

function expectDiagnostic(run: () => void, code: string, path?: string): void {
  try {
    run();
    throw new Error('Expected Executable Registry verification to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(ExecutableRegistryError);
    const diagnostic = (error as ExecutableRegistryError).diagnostics[0];
    expect(diagnostic.code).toBe(code);
    if (path !== undefined) expect(diagnostic.path).toBe(path);
  }
}

describe('Executable Registry V1', () => {
  test('builds deterministic entries and a joint Graph/Registry assemblyId', () => {
    const source = graph();
    const assembly = buildExecutableRegistry(source);

    expect(assembly.registry.entries.map(entry => entry.entryId)).toEqual([
      'product.alpha.web',
      'product.web',
      'product.zeta.web',
    ]);
    expect(assembly.graph.assemblyId).toBe(assembly.registry.assemblyId);
    expect(assembly.registry.assemblyId).toMatch(/^[a-f0-9]{64}$/);
    expect(assembly.registry.bindings).toEqual([]);
    expect(assembly.registry.handlers).toEqual([]);
    verifyExecutableRegistry(assembly.graph, assembly.registry);
  });

  test('builds the same Registry contract for a minimal server target', () => {
    const candidate = input();
    candidate.config.targets = ['server'];
    candidate.manifest.entries = { server: './product/backend/index.js' };
    candidate.modules = [
      {
        id: 'alpha',
        descriptor: './product/modules/alpha/module.jsonc',
        entries: { server: './product/modules/alpha/backend/index.js' },
      },
    ];
    const source = buildMinimalProductGraphs(candidate)[0]!;
    const assembly = buildExecutableRegistry(source);

    expect(assembly.registry.target).toBe('server');
    expect(assembly.registry.entries.map(entry => entry.entryId)).toEqual([
      'product.alpha.server',
      'product.server',
    ]);
    expect(assembly.graph.assemblyId).toBe(assembly.registry.assemblyId);
    verifyExecutableRegistry(assembly.graph, assembly.registry);
  });

  test('normalizes Graph module and entry order before generating Registry bytes', () => {
    const left = graph();
    const right = structuredClone(left);
    right.modules.reverse();
    right.entries.reverse();

    expect(buildExecutableRegistry(right)).toEqual(buildExecutableRegistry(left));
  });

  test('is independent from the current working directory', async () => {
    const originalDirectory = process.cwd();
    const leftDirectory = await mkdtemp(join(tmpdir(), 'blankspace-registry-left-'));
    const rightDirectory = await mkdtemp(join(tmpdir(), 'blankspace-registry-right-'));

    try {
      process.chdir(leftDirectory);
      const left = buildExecutableRegistry(graph());
      process.chdir(rightDirectory);
      const right = buildExecutableRegistry(graph());
      expect(right).toEqual(left);
    } finally {
      process.chdir(originalDirectory);
      await Promise.all([
        rm(leftDirectory, { recursive: true }),
        rm(rightDirectory, { recursive: true }),
      ]);
    }
  });

  test('rejects missing and extra entries before any factory can run', () => {
    const assembly = buildExecutableRegistry(graph());
    const missing = structuredClone(assembly.registry);
    missing.entries = missing.entries.slice(1);
    expectDiagnostic(
      () => verifyExecutableRegistry(assembly.graph, missing),
      'E_REGISTRY_ENTRY_MISSING',
      'registry.entries',
    );

    const extra = structuredClone(assembly.registry);
    extra.entries.push({
      entryId: 'product.extra.web',
      ownerId: 'extra',
      target: 'web',
      module: './product/extra.js',
      exportName: 'default',
    });
    expectDiagnostic(
      () => verifyExecutableRegistry(assembly.graph, extra),
      'E_REGISTRY_ENTRY_EXTRA',
      'registry.entries',
    );
  });

  test.each([
    ['ownerId', 'rewritten-owner'],
    ['module', './product/rewritten.js'],
    ['exportName', 'rewrittenExport'],
    ['target', 'server'],
  ] as const)('rejects rewritten entry %s', (field, value) => {
    const assembly = buildExecutableRegistry(graph());
    const registry = structuredClone(assembly.registry);
    Object.assign(registry.entries[0]!, { [field]: value });

    expectDiagnostic(
      () => verifyExecutableRegistry(assembly.graph, registry),
      'E_REGISTRY_ENTRY_MISMATCH',
      `registry.entries.${registry.entries[0]!.entryId}.${field}`,
    );
  });

  test('rejects duplicate entries', () => {
    const assembly = buildExecutableRegistry(graph());
    const registry = structuredClone(assembly.registry);
    registry.entries.push({ ...registry.entries[0]! });

    expectDiagnostic(
      () => verifyExecutableRegistry(assembly.graph, registry),
      'E_REGISTRY_ENTRY_DUPLICATE',
      'registry.entries',
    );
  });

  test('rejects Graph/Registry assemblyId disagreement first', () => {
    const assembly = buildExecutableRegistry(graph());
    const registry = structuredClone(assembly.registry);
    registry.assemblyId = '0'.repeat(64);

    expectDiagnostic(
      () => verifyExecutableRegistry(assembly.graph, registry),
      'E_REGISTRY_ASSEMBLY_MISMATCH',
      'assemblyId',
    );
  });

  test('binds the assemblyId to actual Registry content and ordering', () => {
    const assembly = buildExecutableRegistry(graph());
    const reordered = structuredClone(assembly.registry);
    reordered.entries.reverse();

    expectDiagnostic(
      () => verifyExecutableRegistry(assembly.graph, reordered),
      'E_REGISTRY_ASSEMBLY_INVALID',
      'registry.assemblyId',
    );
  });

  test('derives canonical Service bindings and Event handlers only from Graph declarations', () => {
    const assembly = buildExecutableRegistry(graphWithBindings());

    expect(assembly.registry.bindings).toEqual([
      { serviceId: 'service.clock', providerId: 'alpha', entryId: 'product.alpha.web' },
      { serviceId: 'service.search', providerId: 'zeta', entryId: 'product.zeta.web' },
    ]);
    expect(assembly.registry.handlers).toEqual([
      { eventId: 'event.tick', handlerId: 'handler.alpha-tick', entryId: 'product.alpha.web' },
      { eventId: 'event.updated', handlerId: 'handler.zeta-updated', entryId: 'product.zeta.web' },
    ]);
    verifyExecutableRegistry(assembly.graph, assembly.registry);
  });

  test('rejects missing, extra, duplicate and rewritten Service bindings', () => {
    const assembly = buildExecutableRegistry(graphWithBindings());

    const missing = structuredClone(assembly.registry);
    missing.bindings = missing.bindings.slice(1);
    expectDiagnostic(() => verifyExecutableRegistry(assembly.graph, missing), 'E_REGISTRY_BINDING_MISSING', 'registry.bindings');

    const extra = structuredClone(assembly.registry);
    extra.bindings.push({ serviceId: 'service.extra', providerId: 'extra', entryId: extra.entries[0]!.entryId });
    expectDiagnostic(() => verifyExecutableRegistry(assembly.graph, extra), 'E_REGISTRY_BINDING_EXTRA', 'registry.bindings');

    const duplicate = structuredClone(assembly.registry);
    duplicate.bindings.push({ ...duplicate.bindings[0]! });
    expectDiagnostic(() => verifyExecutableRegistry(assembly.graph, duplicate), 'E_REGISTRY_BINDING_DUPLICATE', 'registry.bindings');

    const rewritten = structuredClone(assembly.registry);
    rewritten.bindings[0]!.providerId = 'rewritten-provider';
    expectDiagnostic(
      () => verifyExecutableRegistry(assembly.graph, rewritten),
      'E_REGISTRY_BINDING_MISMATCH',
      'registry.bindings.service.clock.providerId',
    );
  });

  test('rejects missing, extra, duplicate and rewritten Event handlers', () => {
    const assembly = buildExecutableRegistry(graphWithBindings());

    const missing = structuredClone(assembly.registry);
    missing.handlers = missing.handlers.slice(1);
    expectDiagnostic(() => verifyExecutableRegistry(assembly.graph, missing), 'E_REGISTRY_HANDLER_MISSING', 'registry.handlers');

    const extra = structuredClone(assembly.registry);
    extra.handlers.push({ eventId: 'event.extra', handlerId: 'handler.extra', entryId: extra.entries[0]!.entryId });
    expectDiagnostic(() => verifyExecutableRegistry(assembly.graph, extra), 'E_REGISTRY_HANDLER_EXTRA', 'registry.handlers');

    const duplicate = structuredClone(assembly.registry);
    duplicate.handlers.push({ ...duplicate.handlers[0]! });
    expectDiagnostic(() => verifyExecutableRegistry(assembly.graph, duplicate), 'E_REGISTRY_HANDLER_DUPLICATE', 'registry.handlers');

    const rewritten = structuredClone(assembly.registry);
    rewritten.handlers[0]!.eventId = 'event.rewritten';
    expectDiagnostic(
      () => verifyExecutableRegistry(assembly.graph, rewritten),
      'E_REGISTRY_HANDLER_MISMATCH',
      'registry.handlers.handler.alpha-tick.eventId',
    );
  });
});
