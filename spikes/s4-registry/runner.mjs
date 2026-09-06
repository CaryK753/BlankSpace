import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildExecutableRegistry,
  buildMinimalProductGraphs,
  verifyExecutableRegistry,
} from '../../packages/compiler/dist/index.js';

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function input() {
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

function buildVariant(reverse = false) {
  const candidate = input();
  if (reverse) candidate.modules.reverse();
  const graph = buildMinimalProductGraphs(candidate)[0];
  if (graph === undefined) throw new Error('S4 fixture did not produce a web graph.');
  if (reverse) {
    graph.modules.reverse();
    graph.entries.reverse();
  }
  return buildExecutableRegistry(graph);
}

function diagnostic(id, assembly, mutate) {
  const graph = structuredClone(assembly.graph);
  const registry = structuredClone(assembly.registry);
  mutate(graph, registry);
  try {
    verifyExecutableRegistry(graph, registry);
    throw new Error(`S4 fixture ${id} unexpectedly passed verification.`);
  } catch (error) {
    if (typeof error !== 'object' || error === null || !('diagnostics' in error)) throw error;
    const item = error.diagnostics?.[0];
    if (item === undefined) throw error;
    return { id, code: item.code, path: item.path };
  }
}

function mismatchMatrix(assembly) {
  return [
    diagnostic('missing-entry', assembly, (_graph, registry) => {
      registry.entries = registry.entries.slice(1);
    }),
    diagnostic('extra-entry', assembly, (_graph, registry) => {
      registry.entries.push({
        entryId: 'product.extra.web',
        ownerId: 'extra',
        target: 'web',
        module: './product/extra.js',
        exportName: 'default',
      });
    }),
    diagnostic('rewritten-owner', assembly, (_graph, registry) => {
      registry.entries[0].ownerId = 'rewritten-owner';
    }),
    diagnostic('rewritten-target', assembly, (_graph, registry) => {
      registry.entries[0].target = 'server';
    }),
    diagnostic('rewritten-module', assembly, (_graph, registry) => {
      registry.entries[0].module = './product/rewritten.js';
    }),
    diagnostic('rewritten-export', assembly, (_graph, registry) => {
      registry.entries[0].exportName = 'rewrittenExport';
    }),
    diagnostic('assembly-mismatch', assembly, (_graph, registry) => {
      registry.assemblyId = '0'.repeat(64);
    }),
    diagnostic('registry-order-drift', assembly, (_graph, registry) => {
      registry.entries.reverse();
    }),
    diagnostic('extra-binding', assembly, (_graph, registry) => {
      registry.bindings.push({
        serviceId: 'service.clock',
        providerId: 'provider.clock',
        entryId: registry.entries[0].entryId,
      });
    }),
    diagnostic('extra-handler', assembly, (_graph, registry) => {
      registry.handlers.push({
        eventId: 'event.tick',
        handlerId: 'handler.tick',
        entryId: registry.entries[0].entryId,
      });
    }),
  ];
}

export async function runRegistryMatrix() {
  const originalDirectory = process.cwd();
  const leftDirectory = await mkdtemp(join(tmpdir(), 'blankspace-s4-left-'));
  const rightDirectory = await mkdtemp(join(tmpdir(), 'blankspace-s4-right-'));

  try {
    process.chdir(leftDirectory);
    const left = buildVariant(false);
    process.chdir(rightDirectory);
    const right = buildVariant(true);
    if (stableJson(left) !== stableJson(right)) {
      throw new Error('S4 Registry output changed across working-directory/input-order variants.');
    }
    verifyExecutableRegistry(left.graph, left.registry);

    const canonical = { graph: left.graph, registry: left.registry };
    return {
      schemaVersion: '1',
      environment: { platform: process.platform, arch: process.arch },
      matrix: { workingDirectoryCount: 2, inputOrderCount: 2 },
      assemblyId: left.registry.assemblyId,
      registryHash: sha256(stableJson(canonical)),
      entryIds: left.registry.entries.map(entry => entry.entryId),
      bindings: left.registry.bindings.length,
      handlers: left.registry.handlers.length,
      factoryExecutions: 0,
      mismatches: mismatchMatrix(left),
    };
  } finally {
    process.chdir(originalDirectory);
    await Promise.all([
      rm(leftDirectory, { recursive: true }),
      rm(rightDirectory, { recursive: true }),
    ]);
  }
}

export { stableJson };
