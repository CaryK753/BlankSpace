import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';
import {BUDGETS, IMAGE, IMAGE_DIGEST, SCENARIO_IDS, canonicalJson, sha256} from './constants.mjs';
import {assertNoS7Resources, inspectImage} from './docker-postgres.mjs';
import {runScenario} from './scenarios.mjs';

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function runDatabaseMatrix() {
  const [image, packages] = await Promise.all([inspectImage(), installedVersions()]);
  await assertNoS7Resources();
  const forward = await execute(SCENARIO_IDS, 'forward');
  const reverse = await execute([...SCENARIO_IDS].reverse(), 'reverse');
  if (canonicalJson(forward) !== canonicalJson(reverse)) {
    throw new Error('S7 output changed between forward and reverse enumeration.');
  }
  await assertNoS7Resources();
  return {
    schemaVersion: '1',
    environment: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      containerOs: image.os,
      containerArchitecture: image.architecture,
      packages,
    },
    image: {reference: IMAGE, indexDigest: IMAGE_DIGEST},
    budgets: {...BUDGETS},
    matrix: {runCount: 2, scenarioCount: forward.length},
    matrixHash: sha256(forward),
    scenarios: forward,
  };
}

async function execute(order, direction) {
  const entries = [];
  for (const id of order) {
    entries.push(await withDeadline(runScenario(id, direction), id));
  }
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return SCENARIO_IDS.map((id) => byId.get(id));
}

async function withDeadline(operation, id) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`S7 scenario ${id} exceeded harness deadline.`)), BUDGETS.harnessDeadlineMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function installedVersions() {
  return Object.fromEntries(await Promise.all([
    ['pg', 'pg'], ['typesPg', '@types/pg'], ['kysely', 'kysely'], ['drizzleOrm', 'drizzle-orm'],
  ].map(async ([key, name]) => [key, await packageVersion(name)])));
}

async function packageVersion(name) {
  const require = createRequire(import.meta.url);
  let directory = dirname(require.resolve(name));
  for (let depth = 0; depth < 8; depth += 1) {
    try {
      const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
      if (manifest.name === name) return manifest.version;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    directory = dirname(directory);
  }
  throw new Error(`Cannot resolve package version for ${name}.`);
}
