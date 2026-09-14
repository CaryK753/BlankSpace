import { readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ValidateFunction } from 'ajv';
import { Ajv2020 } from 'ajv/dist/2020.js';

import { hashCanonical, validateJsonc, type JsonObject, type JsonValue } from './jsonc.js';

export type ProductDirectoryDiagnosticCode =
  | 'E_PRODUCT_DIRECTORY_FILE'
  | 'E_PRODUCT_DIRECTORY_ID_MISMATCH'
  | 'E_PRODUCT_DIRECTORY_MODULE_DUPLICATE'
  | 'E_PRODUCT_DIRECTORY_MODULE_MISSING'
  | 'E_PRODUCT_DIRECTORY_PATH_ESCAPE';

export interface ProductDirectoryDiagnostic {
  code: ProductDirectoryDiagnosticCode;
  path: string;
  message: string;
}

export interface LoadedProductModule {
  id: string;
  directory: string;
  descriptor: JsonObject;
}

export interface LoadedProductDirectory {
  config: JsonObject;
  manifest: JsonObject;
  productDirectory: string;
  modules: LoadedProductModule[];
  canonicalHash: string;
}

export class ProductDirectoryError extends Error {
  readonly diagnostics: ProductDirectoryDiagnostic[];

  constructor(diagnostic: ProductDirectoryDiagnostic) {
    super(`${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`);
    this.name = 'ProductDirectoryError';
    this.diagnostics = [diagnostic];
  }
}

const schemaDirectory = join(dirname(fileURLToPath(import.meta.url)), '../../../contracts/schemas');
let validators: Promise<Record<'config' | 'manifest' | 'module', ValidateFunction>> | undefined;

async function schemaValidators() {
  validators ??= (async () => {
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    const load = async (name: string) => JSON.parse(await readFile(join(schemaDirectory, name), 'utf8'));
    ajv.addSchema(await load('shared.schema.json'));
    return {
      config: ajv.compile(await load('product-config.schema.json')),
      manifest: ajv.compile(await load('product-manifest.schema.json')),
      module: ajv.compile(await load('module.schema.json')),
    };
  })();
  return validators;
}

function fail(code: ProductDirectoryDiagnosticCode, path: string, message: string): never {
  throw new ProductDirectoryError({ code, path, message });
}

function assertObject(value: JsonValue, path: string): JsonObject {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    fail('E_PRODUCT_DIRECTORY_FILE', path, 'Expected an object document');
  }
  return value;
}

async function readDocument(path: string, validate: ValidateFunction): Promise<JsonObject> {
  try {
    return assertObject(validateJsonc(await readFile(path, 'utf8'), validate), path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      fail('E_PRODUCT_DIRECTORY_FILE', path, 'Required configuration file is missing');
    }
    throw error;
  }
}

function within(parent: string, candidate: string): boolean {
  const path = relative(parent, candidate);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

async function boundedRealpath(parent: string, candidate: string, logicalPath: string): Promise<string> {
  let actual: string;
  try {
    actual = await realpath(candidate);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      fail('E_PRODUCT_DIRECTORY_MODULE_MISSING', logicalPath, 'Declared directory does not exist');
    }
    throw error;
  }
  if (!within(parent, actual)) fail('E_PRODUCT_DIRECTORY_PATH_ESCAPE', logicalPath, 'Resolved path escapes its owner');
  return actual;
}

function modulePath(value: string): string {
  const normalized = value.replace(/^\.\//, '');
  if (!/^modules\/[^/]+$/.test(normalized)) {
    fail('E_PRODUCT_DIRECTORY_PATH_ESCAPE', value, 'Module allowlist entries must name one modules/<directory> path');
  }
  return normalized;
}

export async function loadProductDirectory(workspaceRoot: string): Promise<LoadedProductDirectory> {
  const root = await realpath(resolve(workspaceRoot));
  const validate = await schemaValidators();
  const config = await readDocument(join(root, 'blankspace.config.jsonc'), validate.config);
  const productRef = config.product;
  if (typeof productRef !== 'string') fail('E_PRODUCT_DIRECTORY_FILE', '$.product', 'Missing product directory');
  const product = await boundedRealpath(root, resolve(root, productRef), '$.product');
  const manifest = await readDocument(join(product, 'manifest.jsonc'), validate.manifest);
  const modulesRoot = join(product, 'modules');
  const discovered = new Map<string, string>();
  try {
    for (const entry of await readdir(modulesRoot, { withFileTypes: true })) {
      if (entry.isDirectory() || entry.isSymbolicLink()) discovered.set(`modules/${entry.name}`, join(modulesRoot, entry.name));
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const selected = Array.isArray(manifest.modules)
    ? manifest.modules.map(value => modulePath(String(value)))
    : [...discovered.keys()].sort();
  const candidates: Array<LoadedProductModule & { logical: string }> = [];
  for (const logical of selected) {
    const candidate = discovered.get(logical) ?? join(product, logical);
    const directory = await boundedRealpath(modulesRoot, candidate, logical);
    const descriptor = await readDocument(join(directory, 'module.jsonc'), validate.module);
    const id = descriptor.id;
    if (typeof id !== 'string') fail('E_PRODUCT_DIRECTORY_FILE', `${logical}/module.jsonc`, 'Missing module id');
    candidates.push({ id, directory: `./${logical}`, descriptor, logical });
  }
  const byId = new Map<string, LoadedProductModule>();
  for (const { id, directory, descriptor, logical } of candidates) {
    const directoryName = logical.slice('modules/'.length);
    if (byId.has(id)) fail('E_PRODUCT_DIRECTORY_MODULE_DUPLICATE', logical, `Duplicate module id ${id}`);
    byId.set(id, { id, directory, descriptor });
  }
  for (const { id, logical } of candidates) {
    const directoryName = logical.slice('modules/'.length);
    if (id !== directoryName) fail('E_PRODUCT_DIRECTORY_ID_MISMATCH', logical, `Module id ${id} does not match directory ${directoryName}`);
  }
  const modules = [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
  const normalized = { config, manifest, productDirectory: productRef, modules };
  return { ...normalized, canonicalHash: hashCanonical(normalized as unknown as JsonValue) };
}
