import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.resolve('vitest/package.json'));
const vite = await import(pathToFileURL(require.resolve('vite')).href);
const entry = 'packages/app/src/artifact-entry.ts';
const hash = value => createHash('sha256').update(value).digest('hex');
const clean = value => value.replace(/^[ \t]*\/\/#region .*\n/gm, '').replace(/^[ \t]*\/\/#endregion\n?/gm, '');

function outputHash(output) {
  if (output.type === 'chunk') return hash(clean(output.code));
  const source = typeof output.source === 'string' ? output.source : Buffer.from(output.source ?? []);
  return hash(source);
}

function record(kind, sourceIdentity, output, contentHash = outputHash(output)) {
  return { kind, sourceIdentity, fileName: output.fileName, target: 'web', contentHash };
}

function workerHash(output) {
  const source = typeof output.source === 'string' ? output.source : Buffer.from(output.source ?? []).toString('utf8');
  return hash(clean(source));
}

function classify(output) {
  const name = output.fileName;
  if (name.endsWith('.css')) return record('css', 'packages/app/src/artifact-style.css', output);
  if (name.endsWith('.wasm')) return record('wasm', 'packages/app/src/artifact-module.wasm', output);
  if (name.endsWith('.svg')) return record('asset', 'packages/app/src/artifact-logo.svg', output);
  if (name.includes('artifact-worker') && name.endsWith('.js')) {
    return record('worker', 'packages/app/src/artifact-worker.ts', output, workerHash(output));
  }
}

function virtualRecords(output) {
  if (output.type !== 'chunk') return [];
  return Object.entries(output.modules ?? {}).filter(([id]) => id === '\0virtual:blankspace-s3').map(([, info]) => ({
    kind: 'virtual-module', sourceIdentity: 'virtual:blankspace-s3', fileName: output.fileName,
    target: 'web', contentHash: hash(clean(info.code ?? '')),
  }));
}

const virtualPlugin = {
  name: 'blankspace-s3-virtual-module',
  resolveId: id => id === 'virtual:blankspace-s3' ? '\0virtual:blankspace-s3' : null,
  load: id => id === '\0virtual:blankspace-s3' ? "export const virtualValue = 'blankspace-s3-virtual';" : null,
};

export async function observeViteArtifacts(root) {
  const result = await vite.build({
    root, configFile: false, mode: 'production', logLevel: 'silent',
    plugins: [virtualPlugin],
    build: { write: false, minify: false, cssCodeSplit: true, assetsInlineLimit: 0, rollupOptions: {
      input: join(root, entry), output: { entryFileNames: 'chunks/[name].js', chunkFileNames: 'chunks/[name].js', assetFileNames: 'assets/[name][extname]' },
    } },
    worker: { rollupOptions: { output: { entryFileNames: 'workers/[name].js', chunkFileNames: 'workers/[name].js' } } },
  });
  const outputs = Array.isArray(result) ? result.flatMap(item => item.output) : result.output;
  const records = [];
  for (const output of outputs) {
    const item = classify(output);
    if (item) records.push(item);
    records.push(...virtualRecords(output));
  }
  return records;
}
