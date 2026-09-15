import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import {
  ConfigValidationError,
  ProductDirectoryError,
  hashCanonical,
  loadProductDirectory,
} from '../src/index.js';

const workspaces: string[] = [];
const declarations = {
  schemaVersion: '1',
  serviceProviders: [{
    serviceId: 'blankspace.documents', contractVersion: '1.0.0',
    providerId: 'documents.local', entry: 'server',
  }],
};

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

async function createWorkspace(options: { digest?: string; reference?: string } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'blankspace-declarations-'));
  workspaces.push(root);
  const module = join(root, 'product', 'modules', 'documents');
  await mkdir(module, { recursive: true });
  await writeFile(join(root, 'blankspace.config.jsonc'), JSON.stringify({
    schemaVersion: '1', product: './product', targets: ['server'],
  }));
  await writeFile(join(root, 'product', 'manifest.jsonc'), JSON.stringify({ schemaVersion: '1' }));
  await writeFile(join(module, 'index.ts'), 'export default {}');
  await writeFile(join(module, 'module.jsonc'), JSON.stringify({
    schemaVersion: '1', id: 'documents', entries: { server: './index.ts' },
    declarations: {
      path: options.reference ?? './runtime-declarations.jsonc',
      sha256: options.digest ?? hashCanonical(declarations),
    },
  }));
  return { root, module };
}

async function expectDirectoryError(root: string, code: string) {
  try {
    await loadProductDirectory(root);
    expect.unreachable('expected declarations loading to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(ProductDirectoryError);
    expect((error as ProductDirectoryError).diagnostics[0]?.code).toBe(code);
  }
}

describe('Product Directory runtime declarations', () => {
  test('loads strict JSONC and verifies its canonical digest', async () => {
    const { root, module } = await createWorkspace();
    await writeFile(join(module, 'runtime-declarations.jsonc'), `{
      // Formatting does not change content identity.
      "serviceProviders": [{"entry":"server","providerId":"documents.local","contractVersion":"1.0.0","serviceId":"blankspace.documents"}],
      "schemaVersion": "1",
    }`);

    const loaded = await loadProductDirectory(root);
    expect(loaded.modules[0]?.declarations).toEqual(declarations);
    expect(JSON.stringify(loaded)).not.toContain(root);
  });

  test('preserves modules without declarations', async () => {
    const { root, module } = await createWorkspace();
    const descriptor = { schemaVersion: '1', id: 'documents', entries: { server: './index.ts' } };
    await writeFile(join(module, 'module.jsonc'), JSON.stringify(descriptor));
    expect((await loadProductDirectory(root)).modules[0]).not.toHaveProperty('declarations');
  });

  test('rejects a missing declarations file', async () => {
    const { root } = await createWorkspace();
    await expectDirectoryError(root, 'E_PRODUCT_DIRECTORY_DECLARATIONS_MISSING');
  });

  test('rejects a declarations directory', async () => {
    const { root, module } = await createWorkspace();
    await mkdir(join(module, 'runtime-declarations.jsonc'));
    await expectDirectoryError(root, 'E_PRODUCT_DIRECTORY_DECLARATIONS_NOT_FILE');
  });

  test('rejects declarations symlinks that escape the Module owner', async () => {
    const { root, module } = await createWorkspace();
    const outside = join(root, 'outside.jsonc');
    await writeFile(outside, JSON.stringify(declarations));
    await symlink(outside, join(module, 'runtime-declarations.jsonc'));
    await expectDirectoryError(root, 'E_PRODUCT_DIRECTORY_PATH_ESCAPE');
  });

  test('rejects a canonical digest mismatch', async () => {
    const { root, module } = await createWorkspace({ digest: 'a'.repeat(64) });
    await writeFile(join(module, 'runtime-declarations.jsonc'), JSON.stringify(declarations));
    await expectDirectoryError(root, 'E_PRODUCT_DIRECTORY_DECLARATIONS_HASH');
  });

  test('preserves schema validation failures', async () => {
    const invalid = { schemaVersion: '1', discoveredAt: 'runtime' };
    const { root, module } = await createWorkspace({ digest: hashCanonical(invalid) });
    await writeFile(join(module, 'runtime-declarations.jsonc'), JSON.stringify(invalid));
    await expect(loadProductDirectory(root)).rejects.toBeInstanceOf(ConfigValidationError);
  });

  test('returns byte-equal records and hashes across checkout paths', async () => {
    const fixtures = await Promise.all([createWorkspace(), createWorkspace()]);
    await Promise.all(fixtures.map(({ module }) =>
      writeFile(join(module, 'runtime-declarations.jsonc'), JSON.stringify(declarations))));
    const loaded = await Promise.all(fixtures.map(({ root }) => loadProductDirectory(root)));
    expect(JSON.stringify(loaded[0])).toBe(JSON.stringify(loaded[1]));
  });
});
