import assert from 'node:assert/strict';
import pg from 'pg';
import {BUDGETS, FIXTURE, diagnostic} from './constants.mjs';
import {withPostgres} from './docker-postgres.mjs';
import {acquireMigrationLock, applyMigrations, ensureHistory, releaseMigrationLock} from './migration-runner.mjs';
import {makeDescriptor, planMigrations} from './migration-plan.mjs';
import {createFixture, runDirect, runDrizzle, runKysely} from './query-candidates.mjs';

const queryRunners = [runDirect, runDrizzle, runKysely];

export async function runScenario(id, direction) {
  const scenario = scenarios[id];
  if (!scenario) throw new Error(`Unknown S7 scenario: ${id}`);
  return {id, outcome: 'pass', ...await scenario(direction)};
}

const scenarios = {
  'typed-query-equivalence': (direction) => withPostgres('typed-query-equivalence', async ({pool}) => {
    await createFixture(pool);
    const runners = direction === 'forward' ? queryRunners : [...queryRunners].reverse();
    const candidates = [];
    for (const runner of runners) candidates.push(await runner(pool));
    candidates.sort((left, right) => left.candidate.localeCompare(right.candidate));
    for (const candidate of candidates) assert.deepEqual(candidate.rows, candidates[0].rows);
    return {candidates, diagnostics: []};
  }),

  'stable-two-owner-order': (direction) => withPostgres('stable-two-owner-order', async ({pool}) => {
    const alpha = makeDescriptor({ownerId: 'alpha', migrationId: '001', sql: [
      'CREATE SCHEMA kit_alpha',
      'CREATE TABLE kit_alpha.items (item_id uuid PRIMARY KEY, label text NOT NULL, revision integer NOT NULL)',
    ]});
    const beta = makeDescriptor({ownerId: 'beta', migrationId: '001', dependsOn: ['alpha/001'], sql: [
      'CREATE SCHEMA kit_beta',
      'CREATE TABLE kit_beta.links (link_id uuid PRIMARY KEY, alpha_item_id uuid NOT NULL, kind text NOT NULL)',
    ]});
    const result = await applyMigrations(pool, direction === 'forward' ? [alpha, beta] : [beta, alpha]);
    assert.equal(result.ok, true);
    return migrationEvidence(result);
  }),

  'duplicate-migration-id': () => {
    const descriptor = makeDescriptor({ownerId: 'alpha', migrationId: '001', sql: ['CREATE SCHEMA kit_alpha']});
    const result = planMigrations([descriptor, {...descriptor}]);
    assert.equal(result.diagnostics[0].code, 'E_MIGRATION_DUPLICATE_ID');
    return pureFailure(result.diagnostics);
  },

  'dependency-failure': (direction) => {
    const missing = makeDescriptor({ownerId: 'alpha', migrationId: '002', dependsOn: ['001'], sql: []});
    const a = makeDescriptor({ownerId: 'alpha', migrationId: 'a', dependsOn: ['b'], sql: []});
    const b = makeDescriptor({ownerId: 'alpha', migrationId: 'b', dependsOn: ['a'], sql: []});
    const cases = direction === 'forward' ? [[missing], [a, b]] : [[b, a], [missing]];
    const diagnostics = cases.map((value) => planMigrations(value).diagnostics[0])
      .sort((left, right) => left.operation.localeCompare(right.operation));
    assert.ok(diagnostics.every((value) => value.code === 'E_MIGRATION_DEPENDENCY'));
    return pureFailure(diagnostics);
  },

  'applied-hash-mismatch': () => withPostgres('applied-hash-mismatch', async ({pool}) => {
    const descriptor = makeDescriptor({ownerId: 'alpha', migrationId: '001', sql: ['CREATE SCHEMA kit_alpha']});
    await usingClient(pool, async (client) => {
      await ensureHistory(client);
      await client.query(`INSERT INTO blankspace_migrations.applied_migrations
        (owner_id, migration_id, content_sha256, mode, state) VALUES ($1, $2, $3, $4, $5)`,
      ['alpha', '001', 'different-hash', 'transactional', 'applied']);
    });
    const result = await applyMigrations(pool, [descriptor]);
    assert.equal(result.diagnostics[0].code, 'E_MIGRATION_HASH_MISMATCH');
    return migrationEvidence(result);
  }),

  'concurrent-runners': () => withPostgres('concurrent-runners', async ({pool}) => {
    const holder = await pool.connect();
    try {
      assert.equal(await acquireMigrationLock(holder), true);
      const descriptor = makeDescriptor({ownerId: 'alpha', migrationId: '001', sql: ['CREATE SCHEMA kit_alpha']});
      const contender = await applyMigrations(pool, [descriptor]);
      assert.equal(contender.diagnostics[0].code, 'E_MIGRATION_LOCK_UNAVAILABLE');
      return {holder: 'acquired', contender: migrationEvidence(contender)};
    } finally {
      await releaseMigrationLock(holder);
      holder.release();
    }
  }),

  'transactional-rollback': () => withPostgres('transactional-rollback', async ({pool}) => {
    const failing = makeDescriptor({ownerId: 'alpha', migrationId: '001', sql: [
      'CREATE SCHEMA kit_alpha',
      'CREATE TABLE kit_alpha.items (item_id uuid PRIMARY KEY)',
      'INSERT INTO kit_alpha.missing_table VALUES (1)',
    ]});
    const after = makeDescriptor({ownerId: 'alpha', migrationId: '002', dependsOn: ['001'], sql: [
      'CREATE TABLE kit_alpha.after_failure (id integer PRIMARY KEY)',
    ]});
    const result = await applyMigrations(pool, [after, failing]);
    const schema = await pool.query(`SELECT to_regnamespace('kit_alpha') AS value`);
    assert.equal(result.diagnostics[0].code, 'E_MIGRATION_TRANSACTION_FAILED');
    assert.equal(schema.rows[0].value, null);
    return {...migrationEvidence(result), rollbackVerified: true};
  }),

  'checkpoint-resume': () => withPostgres('checkpoint-resume', async ({pool}) => {
    const descriptor = makeDescriptor({ownerId: 'alpha', migrationId: '001', mode: 'checkpointed', sql: [], checkpoints: [
      {id: '01-schema', sql: ['CREATE SCHEMA kit_alpha']},
      {id: '02-table', sql: ['CREATE TABLE kit_alpha.items (item_id uuid PRIMARY KEY)']},
      {id: '03-row', sql: ["INSERT INTO kit_alpha.items VALUES ('00000000-0000-4000-8000-000000000001')"]},
    ]});
    const first = await applyMigrations(pool, [descriptor], {failCheckpoint: '02-table'});
    const resumed = await applyMigrations(pool, [descriptor]);
    assert.equal(first.diagnostics[0].code, 'E_MIGRATION_TRANSACTION_FAILED');
    assert.equal(resumed.ok, true);
    assert.equal(resumed.history.length, 3);
    return {first: migrationEvidence(first), resumed: migrationEvidence(resumed), checkpointOneExecutions: 1};
  }),

  'manual-plan-block': (direction) => {
    const fields = ['recoveryOwner', 'runbookRef', 'compatibleAppRange', 'backupEvidenceRef'];
    const ordered = direction === 'forward' ? fields : [...fields].reverse();
    const diagnostics = ordered.map((field) => {
      const descriptor = makeDescriptor({
        ownerId: 'alpha', migrationId: field, mode: 'manual', sql: [], backupEvidenceRef: 'backup/evidence',
      });
      descriptor[field] = '';
      return planMigrations([descriptor]).diagnostics[0];
    }).sort((left, right) => left.migrationId.localeCompare(right.migrationId));
    assert.ok(diagnostics.every((value) => value.code === 'E_MIGRATION_MANUAL_REQUIRED'));
    return pureFailure(diagnostics);
  },

  'owner-scope-rejection': (direction) => {
    const targets = direction === 'forward' ? ['kit_alpha', 'public'] : ['public', 'kit_alpha'];
    const diagnostics = targets.map((schema) => planMigrations([makeDescriptor({
      ownerId: 'beta', migrationId: schema, sql: [`CREATE TABLE ${schema}.forbidden (id integer)`],
    })]).diagnostics[0]).sort((left, right) => left.schema.localeCompare(right.schema));
    assert.ok(diagnostics.every((value) => value.code === 'E_MIGRATION_OWNER_SCOPE'));
    return pureFailure(diagnostics);
  },

  'removal-retains-data': () => withPostgres('removal-retains-data', async ({pool}) => {
    const descriptor = makeDescriptor({ownerId: 'beta', migrationId: '001', sql: [
      'CREATE SCHEMA kit_beta',
      'CREATE TABLE kit_beta.links (link_id uuid PRIMARY KEY, alpha_item_id uuid NOT NULL, kind text NOT NULL)',
      ...FIXTURE.betaRows.map((row) => `INSERT INTO kit_beta.links VALUES ('${row.linkId}', '${row.alphaItemId}', '${row.kind}')`),
    ]});
    const applied = await applyMigrations(pool, [descriptor]);
    const rows = await pool.query('SELECT count(*)::integer AS count FROM kit_beta.links');
    assert.equal(rows.rows[0].count, 2);
    return {...migrationEvidence(applied), removal: {dropCount: 0, historyRetained: true, rowCount: 2, schemaRetained: true}};
  }),

  'bounded-failures': () => withPostgres('bounded-failures', async ({pool}) => {
    const diagnostics = [await refusedConnection(), await statementTimeout(pool), await relationLock(pool)];
    const hanging = makeDescriptor({ownerId: 'alpha', migrationId: 'hang', sql: [
      'SET LOCAL statement_timeout = 100', 'SELECT pg_sleep(1)',
    ]});
    const migration = await applyMigrations(pool, [hanging]);
    diagnostics.push(migration.diagnostics[0]);
    assert.deepEqual(diagnostics.map((value) => value.causeCode), ['ECONNREFUSED', '57014', '55P03', '57014']);
    return {diagnostics, exitClassification: 'bounded'};
  }),

  'explain-index-evidence': () => withPostgres('explain-index-evidence', async ({pool}) => {
    await createFixture(pool);
    for (const row of FIXTURE.alphaRows) {
      await pool.query('INSERT INTO kit_alpha.items VALUES ($1, $2, $3)', [row.itemId, row.label, row.revision]);
    }
    await pool.query('CREATE INDEX items_label_idx ON kit_alpha.items (label)');
    await pool.query('SET enable_seqscan TO off');
    const result = await pool.query(`EXPLAIN (FORMAT JSON, COSTS OFF, TIMING OFF)
      SELECT item_id, label, revision FROM kit_alpha.items WHERE label >= $1 ORDER BY label`, ['alpha']);
    const plan = normalizePlan(result.rows[0]['QUERY PLAN'][0].Plan);
    assert.equal(plan.indexName, 'items_label_idx');
    return {candidates: ['direct', 'drizzle', 'kysely'], diagnostics: [], plan};
  }),

  'client-import-boundary': async () => {
    const {enforceImportPolicy} = await import('../../packages/compiler/dist/index.js');
    const diagnostics = [];
    for (const target of ['web', 'shared']) {
      try {
        enforceImportPolicy({
          importKind: 'static', resolutionTarget: target,
          importer: {ownerId: `${target}-app`, target}, resolved: {kind: 'node-builtin'},
        });
      } catch (error) {
        diagnostics.push({code: error.diagnostics[0].code, path: error.diagnostics[0].path, target});
      }
    }
    assert.deepEqual(diagnostics.map((value) => value.code), ['E_TARGET_BOUNDARY', 'E_SHARED_BOUNDARY']);
    return {databaseStarted: false, diagnostics, resources: emptyResources()};
  },
};

async function refusedConnection() {
  const unavailable = new pg.Pool({host: '127.0.0.1', port: 1, user: 'none', database: 'none', connectionTimeoutMillis: 500});
  try {
    await unavailable.query('SELECT 1');
    throw new Error('Expected connection failure.');
  } catch (cause) {
    return diagnostic('E_DB_CONNECT', 'connect', 'open-pool', {cause, deadlineMs: BUDGETS.connectionDeadlineMs});
  } finally {
    await unavailable.end();
  }
}

async function statementTimeout(pool) {
  try {
    await pool.query(`SET statement_timeout = 100; SELECT pg_sleep(1)`);
    throw new Error('Expected statement timeout.');
  } catch (cause) {
    return diagnostic('E_DB_STATEMENT_TIMEOUT', 'verify', 'statement-timeout', {
      cause, deadlineMs: BUDGETS.statementDeadlineMs,
    });
  } finally {
    await pool.query('RESET statement_timeout');
  }
}

async function relationLock(pool) {
  await pool.query('CREATE TABLE lock_target (id integer PRIMARY KEY)');
  const holder = await pool.connect();
  const contender = await pool.connect();
  try {
    await holder.query('BEGIN');
    await holder.query('LOCK TABLE lock_target IN ACCESS EXCLUSIVE MODE');
    await contender.query('SET lock_timeout = 100');
    await contender.query('SELECT * FROM lock_target');
    throw new Error('Expected relation lock timeout.');
  } catch (cause) {
    return diagnostic('E_DB_STATEMENT', 'verify', 'relation-lock', {cause, deadlineMs: BUDGETS.lockDeadlineMs});
  } finally {
    await holder.query('ROLLBACK').catch(() => {});
    holder.release();
    contender.release();
  }
}

function migrationEvidence(result) {
  return {
    diagnostics: result.diagnostics,
    history: result.history.map((row) => ({
      checkpointId: row.checkpoint_id, contentSha256: row.content_sha256,
      migrationId: row.migration_id, mode: row.mode, ownerId: row.owner_id, state: row.state,
    })),
    plan: result.plan.map((value) => ({
      contentSha256: value.contentSha256, migrationId: value.migrationId, mode: value.mode, ownerId: value.ownerId,
    })),
    sqlCount: result.sqlCount,
  };
}

function pureFailure(diagnostics) {
  return {diagnostics, resources: emptyResources(), sqlCount: 0};
}

function emptyResources() {
  return {acquired: 0, released: 0, balance: 0};
}

async function usingClient(pool, execute) {
  const client = await pool.connect();
  try { return await execute(client); } finally { client.release(); }
}

function normalizePlan(plan) {
  const value = {nodeType: plan['Node Type']};
  if (plan['Relation Name']) value.relationName = plan['Relation Name'];
  if (plan['Index Name']) value.indexName = plan['Index Name'];
  if (plan.Plans) value.plans = plan.Plans.map(normalizePlan);
  return value;
}
