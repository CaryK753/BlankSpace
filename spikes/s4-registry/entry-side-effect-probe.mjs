import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const CHILD_PROBE = `
const moduleUrl = process.argv[1];
globalThis.__blankspaceS4FactoryExecutions = 0;
let topLevelEffects = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  topLevelEffects += 1;
  const error = new Error('Forbidden top-level fetch during S4 entry probe.');
  error.code = 'E_ENTRY_TOP_LEVEL_SIDE_EFFECT';
  throw error;
};
let status = 'pass';
let code = null;
try {
  await import(moduleUrl);
} catch (error) {
  if (error?.code !== 'E_ENTRY_TOP_LEVEL_SIDE_EFFECT') throw error;
  status = 'reject';
  code = error.code;
} finally {
  globalThis.fetch = originalFetch;
}
process.stdout.write(JSON.stringify({
  status,
  code,
  topLevelEffects,
  factoryExecutions: globalThis.__blankspaceS4FactoryExecutions,
}));
`;

async function observeGeneratedEntry(directory, fixtureName, source) {
  const fixturePath = join(directory, `${fixtureName}.mjs`);
  const generatedPath = join(directory, `generated-${fixtureName}.mjs`);
  await writeFile(fixturePath, source, 'utf8');
  await writeFile(
    generatedPath,
    `import { createEntry } from ${JSON.stringify(`./${fixtureName}.mjs`)};\nexport const factories = [createEntry];\n`,
    'utf8',
  );

  const { stdout } = await execFileAsync(
    process.execPath,
    ['--input-type=module', '--eval', CHILD_PROBE, pathToFileURL(generatedPath).href],
    { encoding: 'utf8' },
  );
  return JSON.parse(stdout);
}

export async function runEntrySideEffectProbe() {
  const directory = await mkdtemp(join(tmpdir(), 'blankspace-s4-entry-probe-'));
  try {
    const safe = await observeGeneratedEntry(
      directory,
      'safe-entry',
      `export function createEntry() {\n  globalThis.__blankspaceS4FactoryExecutions += 1;\n  return {};\n}\n`,
    );
    const unsafe = await observeGeneratedEntry(
      directory,
      'unsafe-entry',
      `await fetch('https://example.invalid/blankspace-s4-forbidden');\nexport function createEntry() {\n  globalThis.__blankspaceS4FactoryExecutions += 1;\n  return {};\n}\n`,
    );

    if (safe.status !== 'pass' || safe.topLevelEffects !== 0 || safe.factoryExecutions !== 0) {
      throw new Error('Safe generated entry produced a guarded top-level effect or executed a factory.');
    }
    if (unsafe.status !== 'reject' || unsafe.code !== 'E_ENTRY_TOP_LEVEL_SIDE_EFFECT' || unsafe.topLevelEffects !== 1) {
      throw new Error('Unsafe generated entry did not fail through the guarded top-level effect path.');
    }
    if (unsafe.factoryExecutions !== 0) {
      throw new Error('Entry probe executed a factory while checking top-level effects.');
    }

    return {
      guardedOperations: ['fetch'],
      safe,
      unsafe,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
