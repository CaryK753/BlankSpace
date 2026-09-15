import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { buildProductDirectoryAssemblies, verifyExecutableRegistry } from '../src/index.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

async function writeEntry(owner: string, path: string) {
  const absolute = join(owner, path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, 'export default {}');
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'blankspace-joint-assembly-'));
  roots.push(root);
  const product = join(root, 'product');
  const module = join(product, 'modules', 'alpha');
  await mkdir(module, { recursive: true });
  await writeFile(join(root, 'blankspace.config.jsonc'), JSON.stringify({
    schemaVersion: '1', product: './product', targets: ['web', 'server'],
  }));
  await writeFile(join(product, 'manifest.jsonc'), JSON.stringify({
    schemaVersion: '1',
    entries: { web: './frontend/index.ts', server: './backend/index.ts' },
  }));
  await writeFile(join(module, 'module.jsonc'), JSON.stringify({
    schemaVersion: '1',
    id: 'alpha',
    entries: { web: './frontend/index.ts', server: './backend/index.ts' },
  }));
  await Promise.all([
    writeEntry(product, './frontend/index.ts'),
    writeEntry(product, './backend/index.ts'),
    writeEntry(module, './frontend/index.ts'),
    writeEntry(module, './backend/index.ts'),
  ]);
  return root;
}

describe('filesystem Product Graph and Executable Registry assembly', () => {
  test('returns verified target-partitioned joint assemblies in stable order', async () => {
    const assemblies = await buildProductDirectoryAssemblies({
      workspaceRoot: await fixture(),
      frameworkVersion: '0.0.0-test',
    });

    expect(assemblies.map(assembly => assembly.graph.target)).toEqual(['server', 'web']);
    for (const { graph, registry } of assemblies) {
      expect(registry.target).toBe(graph.target);
      expect(registry.assemblyId).toBe(graph.assemblyId);
      expect(registry.entries.every(entry => entry.target === graph.target)).toBe(true);
      verifyExecutableRegistry(graph, registry);
    }
  });

  test('produces byte-equal joint assemblies from two absolute directories', async () => {
    const workspaces = await Promise.all([fixture(), fixture()]);
    const assemblies = await Promise.all(workspaces.map(workspaceRoot =>
      buildProductDirectoryAssemblies({ workspaceRoot, frameworkVersion: '0.0.0-test' })));

    expect(JSON.stringify(assemblies[0])).toBe(JSON.stringify(assemblies[1]));
  });
});
