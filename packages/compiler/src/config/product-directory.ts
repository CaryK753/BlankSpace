import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ValidateFunction } from 'ajv';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ModuleRuntimeDeclarationsV1 } from '@blankspace/contracts';

import { hashCanonical, validateJsonc, type JsonObject, type JsonValue } from './jsonc.js';

export type ProductDirectoryDiagnosticCode =
  | 'E_PRODUCT_DIRECTORY_FILE'
  | 'E_PRODUCT_DIRECTORY_ENTRY_MISSING'
  | 'E_PRODUCT_DIRECTORY_ENTRY_NOT_FILE'
  | 'E_PRODUCT_DIRECTORY_DECLARATIONS_HASH'
  | 'E_PRODUCT_DIRECTORY_DECLARATIONS_MISSING'
  | 'E_PRODUCT_DIRECTORY_DECLARATIONS_NOT_FILE'
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
  declarations?: ModuleRuntimeDeclarationsV1;
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
let validators: Promise<Record<'config' | 'declarations' | 'manifest' | 'module', ValidateFunction>> | undefined;

async function schemaValidators() {
  validators ??= (async () => {
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    const load = async (name: string) => JSON.parse(await readFile(join(schemaDirectory, name), 'utf8'));
    ajv.addSchema(await load('shared.schema.json'));
    return {
      config: ajv.compile(await load('product-config.schema.json')),
      declarations: ajv.compile(await load('module-runtime-declarations-v1.schema.json')),
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

async function boundedRealpath(
  parent: string,
  candidate: string,
  logicalPath: string,
  missingCode: ProductDirectoryDiagnosticCode = 'E_PRODUCT_DIRECTORY_MODULE_MISSING',
  missingMessage = 'Declared directory does not exist',
): Promise<string> {
  let actual: string;
  try {
    actual = await realpath(candidate);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      fail(missingCode, logicalPath, missingMessage);
    }
    throw error;
  }
  if (!within(parent, actual)) fail('E_PRODUCT_DIRECTORY_PATH_ESCAPE', logicalPath, 'Resolved path escapes its owner');
  return actual;
}

async function validateEntries(owner: string, document: JsonObject, logicalPath: string): Promise<void> {
  const entries = document.entries;
  if (entries === null || Array.isArray(entries) || typeof entries !== 'object') return;
  for (const target of ['shared', 'server', 'web']) {
    const entry = entries[target];
    if (typeof entry !== 'string') continue;
    const path = `${logicalPath}.entries.${target}`;
    const actual = await boundedRealpath(
      owner,
      resolve(owner, entry),
      path,
      'E_PRODUCT_DIRECTORY_ENTRY_MISSING',
      'Declared entry file does not exist',
    );
    if (!(await stat(actual)).isFile()) {
      fail('E_PRODUCT_DIRECTORY_ENTRY_NOT_FILE', path, 'Declared entry must resolve to a regular file');
    }
  }
}

async function loadDeclarations(
  owner: string,
  descriptor: JsonObject,
  logicalPath: string,
  validate: ValidateFunction,
): Promise<ModuleRuntimeDeclarationsV1 | undefined> {
  const reference = descriptor.declarations;
  if (reference === null || Array.isArray(reference) || typeof reference !== 'object') return undefined;
  const path = reference.path;
  const expectedHash = reference.sha256;
  if (typeof path !== 'string' || typeof expectedHash !== 'string') return undefined;
  const diagnosticPath = `${logicalPath}/module.jsonc.declarations.path`;
  const actual = await boundedRealpath(
    owner,
    resolve(owner, path),
    diagnosticPath,
    'E_PRODUCT_DIRECTORY_DECLARATIONS_MISSING',
    'Declared runtime declarations file does not exist',
  );
  if (!(await stat(actual)).isFile()) {
    fail('E_PRODUCT_DIRECTORY_DECLARATIONS_NOT_FILE', diagnosticPath, 'Runtime declarations must resolve to a regular file');
  }
  const declarations = await readDocument(actual, validate);
  const actualHash = hashCanonical(declarations);
  if (actualHash !== expectedHash) {
    fail(
      'E_PRODUCT_DIRECTORY_DECLARATIONS_HASH',
      `${logicalPath}/module.jsonc.declarations.sha256`,
      `Runtime declarations hash mismatch: expected ${expectedHash}, received ${actualHash}`,
    );
  }
  return declarations as unknown as ModuleRuntimeDeclarationsV1;
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
  await validateEntries(product, manifest, 'manifest');
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
    await validateEntries(directory, descriptor, logical);
    const declarations = await loadDeclarations(directory, descriptor, logical, validate.declarations);
    const id = descriptor.id;
    if (typeof id !== 'string') fail('E_PRODUCT_DIRECTORY_FILE', `${logical}/module.jsonc`, 'Missing module id');
    candidates.push({
      id,
      directory: `./${logical}`,
      descriptor,
      ...(declarations === undefined ? {} : { declarations }),
      logical,
    });
  }
  const byId = new Map<string, LoadedProductModule>();
  for (const { id, directory, descriptor, declarations, logical } of candidates) {
    const directoryName = logical.slice('modules/'.length);
    if (byId.has(id)) fail('E_PRODUCT_DIRECTORY_MODULE_DUPLICATE', logical, `Duplicate module id ${id}`);
    byId.set(id, { id, directory, descriptor, ...(declarations === undefined ? {} : { declarations }) });
  }
  for (const { id, logical } of candidates) {
    const directoryName = logical.slice('modules/'.length);
    if (id !== directoryName) fail('E_PRODUCT_DIRECTORY_ID_MISMATCH', logical, `Module id ${id} does not match directory ${directoryName}`);
  }
  const modules = [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
  const normalized = { config, manifest, productDirectory: productRef, modules };
  return { ...normalized, canonicalHash: hashCanonical(normalized as unknown as JsonValue) };
}
