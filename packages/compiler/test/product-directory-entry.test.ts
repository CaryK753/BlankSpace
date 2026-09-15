import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { ProductDirectoryError, loadProductDirectory } from '../src/index.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

async function fixture(entry: string, createEntry = true) {
  const root = await mkdtemp(join(tmpdir(), 'blankspace-entry-boundary-'));
  roots.push(root);
  const product = join(root, 'product');
  await mkdir(join(product, 'modules'), { recursive: true });
  await writeFile(join(root, 'blankspace.config.jsonc'), JSON.stringify({
    schemaVersion: '1', product: './product', targets: ['web'],
  }));
  await writeFile(join(product, 'manifest.jsonc'), JSON.stringify({
    schemaVersion: '1', entries: { web: entry },
  }));
  if (createEntry) {
    const path = join(product, entry);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, 'export default {}');
  }
  return { root, product };
}

async function expectCode(root: string, code: string, path: string) {
  try {
    await loadProductDirectory(root);
    expect.unreachable('expected entry validation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(ProductDirectoryError);
    expect((error as ProductDirectoryError).diagnostics).toEqual([
      { code, path, message: expect.any(String) },
    ]);
  }
}

describe('Product Directory entry filesystem boundary', () => {
  test('accepts a regular entry file and retains its logical path', async () => {
    const { root } = await fixture('./frontend/index.ts');
    expect((await loadProductDirectory(root)).manifest.entries).toEqual({
      web: './frontend/index.ts',
    });
  });

  test('rejects a missing entry with its logical descriptor path', async () => {
    const { root } = await fixture('./frontend/missing.ts', false);
    await expectCode(root, 'E_PRODUCT_DIRECTORY_ENTRY_MISSING', 'manifest.entries.web');
  });

  test('bounds Module entries to their owning Module directory', async () => {
    const { root, product } = await fixture('./frontend/index.ts');
    const module = join(product, 'modules', 'alpha');
    await mkdir(module);
    await writeFile(join(module, 'module.jsonc'), JSON.stringify({
      schemaVersion: '1',
      id: 'alpha',
      entries: { server: './backend/missing.ts' },
    }));
    await expectCode(
      root,
      'E_PRODUCT_DIRECTORY_ENTRY_MISSING',
      'modules/alpha.entries.server',
    );
  });

  test('rejects an entry that resolves to a directory', async () => {
    const { root, product } = await fixture('./frontend', false);
    await mkdir(join(product, 'frontend'));
    await expectCode(root, 'E_PRODUCT_DIRECTORY_ENTRY_NOT_FILE', 'manifest.entries.web');
  });

  test('rejects an entry symlink that escapes its Product owner', async () => {
    const { root, product } = await fixture('./frontend/index.ts', false);
    const outside = join(root, 'outside.ts');
    await writeFile(outside, 'export default {}');
    await mkdir(join(product, 'frontend'));
    await symlink(outside, join(product, 'frontend', 'index.ts'), 'file');
    await expectCode(root, 'E_PRODUCT_DIRECTORY_PATH_ESCAPE', 'manifest.entries.web');
  });
});
