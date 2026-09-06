import { execFile } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import ts from 'typescript';
import { createVitest } from 'vitest/node';

const execFileAsync = promisify(execFile);
const vitestPackageUrl = import.meta.resolve('vitest/package.json');
const vitestRequire = createRequire(vitestPackageUrl);
const viteEntry = vitestRequire.resolve('vite');
const vitePackagePath = vitestRequire.resolve('vite/package.json');
const vite = await import(pathToFileURL(viteEntry).href);

async function packageVersion(path) {
  return JSON.parse(await readFile(path, 'utf8')).version;
}

async function traceTypeScript(root, specifier, importer, conditions) {
  const result = ts.resolveModuleName(specifier, importer, {
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    customConditions: [...conditions],
  }, ts.sys);
  const resolvedId = result.resolvedModule?.resolvedFileName;
  if (resolvedId === undefined) throw new Error(`TypeScript did not resolve ${specifier}.`);
  return { tool: 'typescript', conditions, resolvedId };
}

async function traceNode(root, specifier, conditions) {
  const resolver = resolve(root, 'packages/app/src/node-resolve.mjs');
  const { stdout } = await execFileAsync(process.execPath, [resolver, specifier], { encoding: 'utf8' });
  const resolvedId = stdout.trim();
  if (resolvedId.length === 0) throw new Error(`Node did not resolve ${specifier}.`);
  return { tool: 'node', conditions, resolvedId };
}

async function createViteDevAdapter(root, conditions) {
  const server = await vite.createServer({
    root,
    configFile: false,
    mode: 'development',
    logLevel: 'silent',
    resolve: { conditions: [...conditions] },
  });
  return {
    async resolve(specifier, importer) {
      const result = await server.pluginContainer.resolveId(specifier, importer, { ssr: false });
      if (result === null) throw new Error(`Vite dev did not resolve ${specifier}.`);
      return { tool: 'vite', conditions, resolvedId: result.id };
    },
    close: () => server.close(),
  };
}

async function traceViteBuild(root, specifier, importer, conditions) {
  const virtualEntry = '\0blankspace-s2-entry';
  let resolvedId;
  await vite.build({
    root,
    configFile: false,
    mode: 'production',
    logLevel: 'silent',
    resolve: { conditions: [...conditions] },
    build: { write: false, minify: false, rollupOptions: { input: 'blankspace-s2-entry' } },
    plugins: [{
      name: 'blankspace-s2-trace',
      enforce: 'pre',
      resolveId: async function (source, importingFile) {
        if (source === 'blankspace-s2-entry') return virtualEntry;
        if (importingFile !== virtualEntry || source !== specifier) return null;
        const result = await this.resolve(source, importer, { skipSelf: true });
        resolvedId = result?.id;
        return result;
      },
      load(id) {
        return id === virtualEntry
          ? `import * as value from ${JSON.stringify(specifier)}; console.log(value);`
          : null;
      },
    }],
  });
  if (resolvedId === undefined) throw new Error(`Vite build did not resolve ${specifier}.`);
  return { tool: 'vite', conditions, resolvedId };
}

async function createVitestAdapter(root, conditions, alias = []) {
  const context = await createVitest('test', {
    root,
    watch: false,
    run: true,
    passWithNoTests: true,
    config: false,
  }, {
    logLevel: 'silent',
    resolve: { conditions: [...conditions], alias },
  });
  const project = context.projects[0];
  if (project === undefined) throw new Error('Vitest did not create a test project.');
  return {
    async resolve(specifier, importer) {
      const result = await project.vite.pluginContainer.resolveId(specifier, importer, { ssr: false });
      if (result === null) throw new Error(`Vitest did not resolve ${specifier}.`);
      return { tool: 'vitest', conditions, resolvedId: result.id };
    },
    close: () => context.close(),
  };
}

export async function traceVitestWithAlias(root, specifier, importer, conditions, replacement) {
  const adapter = await createVitestAdapter(root, conditions, [{ find: specifier, replacement }]);
  try {
    return await adapter.resolve(specifier, importer);
  } finally {
    await adapter.close();
  }
}

function cleanNativeId(id) {
  const withoutQuery = id.split('?', 1)[0];
  if (withoutQuery.startsWith('file:')) return fileURLToPath(withoutQuery);
  if (withoutQuery.startsWith('/@fs/')) return withoutQuery.slice('/@fs'.length);
  return withoutQuery;
}

export async function logicalPathFromNative(root, id) {
  if (id.startsWith('node:')) return undefined;
  const [realRoot, realId] = await Promise.all([realpath(root), realpath(cleanNativeId(id))]);
  const logicalPath = relative(realRoot, realId).split(sep).join('/');
  if (logicalPath.startsWith('../') || logicalPath === '..' || logicalPath.includes('node_modules')) {
    throw new Error(`Native result escaped the fixture workspace: ${logicalPath}`);
  }
  return logicalPath;
}

export async function createToolAdapters(root, modeConditions) {
  const dev = await createViteDevAdapter(root, modeConditions['web-dev']);
  const test = await createVitestAdapter(root, modeConditions.test);
  return {
    versions: {
      node: process.versions.node,
      typescript: ts.version,
      vite: await packageVersion(vitePackagePath),
      vitest: await packageVersion(fileURLToPath(vitestPackageUrl)),
    },
    async resolve(mode, specifier, importer) {
      const conditions = modeConditions[mode];
      if (mode === 'type') return traceTypeScript(root, specifier, importer, conditions);
      if (mode === 'web-dev') return dev.resolve(specifier, importer);
      if (mode === 'web-build') return traceViteBuild(root, specifier, importer, conditions);
      if (mode === 'server') return traceNode(root, specifier, conditions);
      return test.resolve(specifier, importer);
    },
    async close() {
      await Promise.all([dev.close(), test.close()]);
    },
  };
}
