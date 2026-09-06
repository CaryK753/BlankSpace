import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, test } from 'vitest';

import {
  ProductGraphBuildError,
  buildMinimalProductGraphs,
  type MinimalProductGraphInput,
} from '../src/index.js';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const schemaDirectory = resolve(testDirectory, '../../contracts/schemas');

function graphValidator() {
  const ajv = new Ajv2020({ strict: true });
  ajv.addSchema(JSON.parse(readFileSync(join(schemaDirectory, 'shared.schema.json'), 'utf8')));
  return ajv.compile(JSON.parse(readFileSync(join(schemaDirectory, 'product-graph-v1.schema.json'), 'utf8')));
}

function input(): MinimalProductGraphInput {
  return {
    frameworkVersion: '0.0.0',
    config: {
      schemaVersion: '1',
      product: './product',
      targets: ['web', 'server'],
    },
    manifest: {
      schemaVersion: '1',
      entries: {
        server: './product/backend/index.js',
        web: './product/frontend/index.js',
      },
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
        entries: { server: './product/modules/alpha/backend/index.js' },
      },
    ],
  };
}

describe('buildMinimalProductGraphs', () => {
  test('builds one deterministic graph per requested target', () => {
    const graphs = buildMinimalProductGraphs(input());

    expect(graphs.map(graph => graph.target)).toEqual(['server', 'web']);
    expect(graphs[0]?.modules.map(module => module.id)).toEqual(['alpha', 'zeta']);
    expect(graphs[0]?.entries.map(entry => entry.entryId)).toEqual([
      'product.alpha.server',
      'product.server',
    ]);
    expect(graphs[1]?.entries.map(entry => entry.entryId)).toEqual([
      'product.web',
      'product.zeta.web',
    ]);
  });

  test('normalizes target, module, key and entry declaration order', () => {
    const left = input();
    const right = input();
    right.config.targets.reverse();
    right.modules.reverse();
    right.manifest.entries = {
      web: './product/frontend/index.js',
      server: './product/backend/index.js',
    };

    expect(buildMinimalProductGraphs(right)).toEqual(buildMinimalProductGraphs(left));
  });

  test('does not include checkout paths or runtime timestamps in hashes', () => {
    const graphs = buildMinimalProductGraphs(input());
    const serialized = JSON.stringify(graphs);

    expect(serialized).not.toContain('/Users/');
    expect(serialized).not.toContain('/tmp/');
    expect(serialized).not.toContain('generatedAt');
  });

  test('produces schema-valid graphs', () => {
    const validate = graphValidator();

    for (const graph of buildMinimalProductGraphs(input())) {
      expect(validate(graph), JSON.stringify(validate.errors)).toBe(true);
    }
  });

  test('produces identical graphs from different working directories', async () => {
    const originalDirectory = process.cwd();
    const leftDirectory = await mkdtemp(join(tmpdir(), 'blankspace-graph-left-'));
    const rightDirectory = await mkdtemp(join(tmpdir(), 'blankspace-graph-right-'));

    try {
      process.chdir(leftDirectory);
      const left = buildMinimalProductGraphs(input());
      process.chdir(rightDirectory);
      const right = buildMinimalProductGraphs(input());
      expect(right).toEqual(left);
    } finally {
      process.chdir(originalDirectory);
      await Promise.all([
        rm(leftDirectory, { recursive: true }),
        rm(rightDirectory, { recursive: true }),
      ]);
    }
  });

  test('rejects duplicate module IDs with a stable diagnostic', () => {
    const candidate = input();
    candidate.modules.push({ ...candidate.modules[0]! });

    expectDiagnostics(candidate, ['E_MODULE_ID_DUPLICATE']);
  });

  test('rejects empty, absolute and parent-traversing entry paths', () => {
    const candidate = input();
    candidate.manifest.entries = { web: '' };
    candidate.modules[0]!.entries.server = '/tmp/server.js';
    candidate.modules[1]!.entries.web = './../escape.js';

    expectDiagnostics(candidate, [
      'E_ENTRY_PATH_INVALID',
      'E_ENTRY_PATH_INVALID',
      'E_ENTRY_PATH_INVALID',
    ]);
  });

  test('rejects requested targets without a matching entry', () => {
    const candidate = input();
    candidate.manifest.entries = {};
    candidate.modules = [];

    expectDiagnostics(candidate, ['E_TARGET_ENTRY_MISSING', 'E_TARGET_ENTRY_MISSING']);
  });
});

function expectDiagnostics(input: MinimalProductGraphInput, codes: string[]): void {
  try {
    buildMinimalProductGraphs(input);
    throw new Error('Expected graph construction to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(ProductGraphBuildError);
    expect((error as ProductGraphBuildError).diagnostics.map(diagnostic => diagnostic.code)).toEqual(codes);
  }
}
