import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import {
  ConfigValidationError,
  ProductDirectoryError,
  ProductGraphBuildError,
  adaptProductDirectoryToGraphInput,
  buildProductDirectoryGraphs,
  loadProductDirectory,
} from '../src/index.js';

const workspaces: string[] = [];

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

async function createWorkspace(modules?: string[], manifestEntries?: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), 'blankspace-product-directory-'));
  workspaces.push(root);
  await mkdir(join(root, 'product', 'modules'), { recursive: true });
  await writeFile(join(root, 'blankspace.config.jsonc'), `{
    // JSONC is the canonical configuration dialect.
    "schemaVersion": "1",
    "product": "./product",
    "targets": ["web"],
  }`);
  await writeFile(join(root, 'product', 'manifest.jsonc'), JSON.stringify({
    schemaVersion: '1',
    ...(modules === undefined ? {} : { modules }),
    ...(manifestEntries === undefined ? {} : { entries: manifestEntries }),
  }));
  await writeEntries(join(root, 'product'), manifestEntries);
  return root;
}

async function writeEntries(owner: string, moduleEntries?: Record<string, string>) {
  for (const entry of Object.values(moduleEntries ?? {})) {
    const path = join(owner, entry);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, 'export default {}');
  }
}

async function addModule(
  root: string,
  directory: string,
  id = directory,
  moduleEntries: Record<string, string> = { shared: './index.ts' },
) {
  const path = join(root, 'product', 'modules', directory);
  await mkdir(path, { recursive: true });
  await writeFile(join(path, 'module.jsonc'), JSON.stringify({
    schemaVersion: '1', id, entries: moduleEntries,
  }));
  await writeEntries(path, moduleEntries);
}

async function expectDirectoryError(run: () => Promise<unknown>, code: string) {
  try {
    await run();
    expect.unreachable('expected product directory loading to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(ProductDirectoryError);
    expect((error as ProductDirectoryError).diagnostics[0]?.code).toBe(code);
  }
}

describe('product directory loader', () => {
  test('discovers one-level modules in stable id order with a deterministic hash', async () => {
    const left = await createWorkspace();
    const right = await createWorkspace();
    for (const root of [left, right]) {
      await addModule(root, 'zeta');
      await addModule(root, 'alpha');
    }

    const first = await loadProductDirectory(left);
    const second = await loadProductDirectory(right);

    expect(first.modules.map(module => [module.id, module.directory])).toEqual([
      ['alpha', './modules/alpha'], ['zeta', './modules/zeta'],
    ]);
    expect(first.canonicalHash).toBe(second.canonicalHash);
  });

  test('uses an explicit allowlist instead of every discovered module', async () => {
    const root = await createWorkspace(['./modules/alpha']);
    await addModule(root, 'alpha');
    await addModule(root, 'zeta');

    expect((await loadProductDirectory(root)).modules.map(module => module.id)).toEqual(['alpha']);
  });

  test('rejects a missing allowlisted module', async () => {
    const root = await createWorkspace(['./modules/missing']);
    await expectDirectoryError(
      () => loadProductDirectory(root),
      'E_PRODUCT_DIRECTORY_MODULE_MISSING',
    );
  });

  test('rejects nested module discovery instead of recursively loading it', async () => {
    const root = await createWorkspace();
    await addModule(root, 'group/alpha', 'alpha');
    await expectDirectoryError(
      () => loadProductDirectory(root),
      'E_PRODUCT_DIRECTORY_FILE',
    );
  });

  test('preserves stable schema diagnostics for an invalid module descriptor', async () => {
    const root = await createWorkspace();
    await addModule(root, 'alpha');
    await writeFile(join(root, 'product', 'modules', 'alpha', 'module.jsonc'), '{"id":"alpha"}');

    await expect(loadProductDirectory(root)).rejects.toBeInstanceOf(ConfigValidationError);
  });

  test('rejects a module id that differs from its directory', async () => {
    const root = await createWorkspace();
    await addModule(root, 'alpha', 'other');
    await expectDirectoryError(
      () => loadProductDirectory(root),
      'E_PRODUCT_DIRECTORY_ID_MISMATCH',
    );
  });

  test('rejects duplicate module ids before reporting the alias directory mismatch', async () => {
    const root = await createWorkspace();
    await addModule(root, 'alpha');
    await addModule(root, 'alias', 'alpha');
    await expectDirectoryError(
      () => loadProductDirectory(root),
      'E_PRODUCT_DIRECTORY_MODULE_DUPLICATE',
    );
  });

  test('rejects a module symlink that escapes the modules directory', async () => {
    const root = await createWorkspace(['./modules/outside']);
    const outside = join(root, 'outside');
    await mkdir(outside);
    await writeFile(join(outside, 'module.jsonc'), JSON.stringify({
      schemaVersion: '1', id: 'outside', entries: { shared: './index.ts' },
    }));
    await symlink(outside, join(root, 'product', 'modules', 'outside'), 'dir');

    await expectDirectoryError(
      () => loadProductDirectory(root),
      'E_PRODUCT_DIRECTORY_PATH_ESCAPE',
    );
  });

  test('adapts Product-relative and Module-relative entries without retaining checkout paths', async () => {
    const root = await createWorkspace(undefined, { web: './frontend/index.ts' });
    await addModule(root, 'alpha', 'alpha', {
      shared: './shared/index.ts', web: './frontend/index.ts',
    });

    const directory = await loadProductDirectory(root);
    const input = adaptProductDirectoryToGraphInput(directory, '0.0.0-test');
    expect(input.manifest.entries).toEqual({ web: './product/frontend/index.ts' });
    expect(input.modules).toEqual([{
      id: 'alpha',
      descriptor: './product/modules/alpha/module.jsonc',
      entries: { web: './product/modules/alpha/frontend/index.ts' },
    }]);
    expect(JSON.stringify(input)).not.toContain(root);
  });

  test('builds byte-equal Graphs from two absolute checkout directories', async () => {
    const roots = await Promise.all([
      createWorkspace(undefined, { web: './frontend/index.ts' }),
      createWorkspace(undefined, { web: './frontend/index.ts' }),
    ]);
    await Promise.all(roots.map(root => addModule(root, 'alpha', 'alpha', { web: './index.ts' })));

    const graphs = await Promise.all(roots.map(workspaceRoot =>
      buildProductDirectoryGraphs({ workspaceRoot, frameworkVersion: '0.0.0-test' })));
    expect(JSON.stringify(graphs[0])).toBe(JSON.stringify(graphs[1]));
  });

  test('preserves the existing missing-target-entry Graph diagnostic', async () => {
    const root = await createWorkspace();
    await addModule(root, 'alpha');

    await expect(buildProductDirectoryGraphs({
      workspaceRoot: root,
      frameworkVersion: '0.0.0-test',
    })).rejects.toBeInstanceOf(ProductGraphBuildError);
  });
});
