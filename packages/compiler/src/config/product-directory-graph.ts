import type { ProductGraphV1, RuntimeTarget } from '@blankspace/contracts';

import {
  buildMinimalProductGraphs,
  type MinimalProductGraphInput,
} from '../graph/minimal-product-graph.js';
import { loadProductDirectory, type LoadedProductDirectory } from './product-directory.js';
import type { JsonObject, JsonValue } from './jsonc.js';

export interface ProductDirectoryGraphOptions {
  frameworkVersion: string;
  workspaceRoot: string;
}

function logicalPath(...parts: string[]): string {
  return `./${parts.map(part => part.replace(/^\.\//, '').replace(/\/$/, '')).join('/')}`;
}

function entries(value: JsonValue | undefined): JsonObject {
  return value !== null && !Array.isArray(value) && typeof value === 'object' ? value : Object.create(null);
}

function targetEntries(value: JsonValue | undefined, base: string): Partial<Record<RuntimeTarget, string>> {
  const record = entries(value);
  return Object.fromEntries(
    (['server', 'web'] as const).flatMap(target => {
      const path = record[target];
      return typeof path === 'string' ? [[target, logicalPath(base, path)]] : [];
    }),
  );
}

export function adaptProductDirectoryToGraphInput(
  directory: LoadedProductDirectory,
  frameworkVersion: string,
): MinimalProductGraphInput {
  const targets = directory.config.targets as RuntimeTarget[];
  return {
    frameworkVersion,
    config: {
      schemaVersion: '1',
      product: directory.productDirectory,
      targets: [...targets],
    },
    manifest: {
      schemaVersion: '1',
      entries: targetEntries(directory.manifest.entries, directory.productDirectory),
    },
    modules: directory.modules.map(module => ({
      id: module.id,
      descriptor: logicalPath(directory.productDirectory, module.directory, './module.jsonc'),
      entries: targetEntries(
        module.descriptor.entries,
        logicalPath(directory.productDirectory, module.directory),
      ),
    })),
  };
}

export async function buildProductDirectoryGraphs(
  options: ProductDirectoryGraphOptions,
): Promise<ProductGraphV1[]> {
  const directory = await loadProductDirectory(options.workspaceRoot);
  return buildMinimalProductGraphs(
    adaptProductDirectoryToGraphInput(directory, options.frameworkVersion),
  );
}
