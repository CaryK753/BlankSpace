import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import {SCENARIO_IDS, canonicalJson, sha256} from './constants.mjs';
import {assertNoS7Resources} from './docker-postgres.mjs';
import {runDatabaseMatrix} from './runner.mjs';

const transcriptPromise = runDatabaseMatrix();

function scenario(transcript, id) {
  const value = transcript.scenarios.find((candidate) => candidate.id === id);
  assert.ok(value, `Missing S7 scenario ${id}.`);
  return value;
}

test('S7 executes the frozen corpus twice with exact tools and no leaked resources', async () => {
  const transcript = await transcriptPromise;
  assert.deepEqual(transcript.scenarios.map((value) => value.id), SCENARIO_IDS);
  assert.deepEqual(transcript.environment.packages, {
    pg: '8.23.0', typesPg: '8.23.1', kysely: '0.29.5', drizzleOrm: '0.45.2',
  });
  assert.equal(transcript.matrixHash, sha256(transcript.scenarios));
  assert.ok(transcript.scenarios.every((value) => value.resources?.balance === 0));
  await assertNoS7Resources();
});

test('S7 query candidates produce equal typed rows and parameterized intent', async () => {
  const typed = scenario(await transcriptPromise, 'typed-query-equivalence');
  assert.deepEqual(typed.candidates.map((value) => value.candidate), ['direct', 'drizzle', 'kysely']);
  for (const candidate of typed.candidates) {
    assert.deepEqual(candidate.rows, typed.candidates[0].rows);
    assert.ok(candidate.sqlIntent.every((intent) => intent.parameterized && intent.schema === 'kit_alpha'));
  }
});

test('S7 migration failures preserve plan, lock, rollback, checkpoint and owner semantics', async () => {
  const transcript = await transcriptPromise;
  assert.equal(scenario(transcript, 'stable-two-owner-order').history.length, 2);
  assert.equal(scenario(transcript, 'duplicate-migration-id').diagnostics[0].code, 'E_MIGRATION_DUPLICATE_ID');
  assert.equal(scenario(transcript, 'applied-hash-mismatch').diagnostics[0].code, 'E_MIGRATION_HASH_MISMATCH');
  assert.equal(scenario(transcript, 'concurrent-runners').contender.sqlCount, 0);
  assert.equal(scenario(transcript, 'transactional-rollback').rollbackVerified, true);
  assert.equal(scenario(transcript, 'checkpoint-resume').resumed.history.length, 3);
  assert.equal(scenario(transcript, 'removal-retains-data').removal.dropCount, 0);
});

test('S7 bounded failures, plans and client boundary stay canonical', async () => {
  const transcript = await transcriptPromise;
  assert.equal(scenario(transcript, 'bounded-failures').exitClassification, 'bounded');
  assert.equal(scenario(transcript, 'explain-index-evidence').plan.indexName, 'items_label_idx');
  assert.equal(scenario(transcript, 'client-import-boundary').databaseStarted, false);
  const canonical = canonicalJson(transcript.scenarios);
  for (const forbidden of ['postgres://', '127.0.0.1:', '/Users/', 'node_modules', 'stack']) {
    assert.equal(canonical.includes(forbidden), false, `Canonical transcript leaked ${forbidden}.`);
  }
});

test('S7 transcript matches the local baseline and frozen schema', async () => {
  const [actual, baseline, schema] = await Promise.all([
    transcriptPromise,
    readFile(new URL('./transcripts/macos-arm64.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('./transcript.schema.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  assert.equal(actual.matrixHash, baseline.matrixHash);
  assert.deepEqual(actual.image, baseline.image);
  assert.deepEqual(actual.matrix, baseline.matrix);
  if (process.platform === 'darwin' && process.arch === 'arm64') assert.deepEqual(actual.environment, baseline.environment);
  const validate = new Ajv2020({strict: true}).compile(schema);
  assert.equal(validate(actual), true, JSON.stringify(validate.errors));
});
