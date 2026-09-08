import {BUDGETS, LOCK_KEYS, diagnostic} from './constants.mjs';
import {planMigrations} from './migration-plan.mjs';

export async function ensureHistory(client) {
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS blankspace_migrations;
    CREATE TABLE IF NOT EXISTS blankspace_migrations.applied_migrations (
      owner_id text NOT NULL,
      migration_id text NOT NULL,
      content_sha256 text NOT NULL,
      mode text NOT NULL,
      state text NOT NULL,
      checkpoint_id text NOT NULL DEFAULT '',
      applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (owner_id, migration_id, checkpoint_id)
    )
  `);
}

export async function acquireMigrationLock(client) {
  const result = await client.query('SELECT pg_try_advisory_lock($1, $2) AS acquired', LOCK_KEYS);
  return result.rows[0].acquired === true;
}

export async function releaseMigrationLock(client) {
  await client.query('SELECT pg_advisory_unlock($1, $2)', LOCK_KEYS);
}

export async function applyMigrations(pool, descriptors, options = {}) {
  const planned = planMigrations(descriptors);
  if (!planned.ok) return {...planned, history: [], sqlCount: 0};
  const client = await pool.connect();
  let locked = false;
  let sqlCount = 0;
  const diagnostics = [];
  try {
    locked = await acquireMigrationLock(client);
    if (!locked) return failedLock(planned.plan);
    await ensureHistory(client);
    for (const descriptor of planned.plan) {
      const recorded = await historyFor(client, descriptor);
      const mismatch = recorded.find((row) => row.content_sha256 !== descriptor.contentSha256);
      if (mismatch) {
        diagnostics.push(diagnostic('E_MIGRATION_HASH_MISMATCH', 'verify', 'verify-content-hash', {
          ownerId: descriptor.ownerId, migrationId: descriptor.migrationId,
        }));
        break;
      }
      if (descriptor.mode === 'manual') continue;
      if (descriptor.mode === 'checkpointed') {
        const result = await applyCheckpoints(client, descriptor, recorded, options);
        sqlCount += result.sqlCount;
        diagnostics.push(...result.diagnostics);
      } else if (recorded.length === 0) {
        const result = await applyTransactional(client, descriptor);
        sqlCount += result.sqlCount;
        diagnostics.push(...result.diagnostics);
      }
      if (diagnostics.length > 0) break;
    }
    return {
      ok: diagnostics.length === 0,
      plan: planned.plan,
      diagnostics,
      history: await readHistory(client),
      sqlCount,
    };
  } finally {
    if (locked) await releaseMigrationLock(client).catch(() => {});
    client.release();
  }
}

async function applyTransactional(client, descriptor) {
  let sqlCount = 0;
  try {
    await client.query('BEGIN');
    await setDeadlines(client);
    for (const sql of descriptor.sql) {
      await client.query(sql);
      sqlCount += 1;
    }
    await insertHistory(client, descriptor, '', 'applied');
    await client.query('COMMIT');
    return {diagnostics: [], sqlCount};
  } catch (cause) {
    await client.query('ROLLBACK').catch(() => {});
    const deadline = cause.code === '57014';
    return {diagnostics: [diagnostic(
      deadline ? 'E_MIGRATION_DEADLINE' : 'E_MIGRATION_TRANSACTION_FAILED',
      'apply', deadline ? 'migration-deadline' : 'transaction', {
        ownerId: descriptor.ownerId, migrationId: descriptor.migrationId,
        cause, deadlineMs: deadline ? BUDGETS.migrationDeadlineMs : undefined,
      },
    )], sqlCount};
  }
}

async function applyCheckpoints(client, descriptor, recorded, options) {
  const completed = new Set(recorded.map((row) => row.checkpoint_id));
  let sqlCount = 0;
  const diagnostics = [];
  for (const checkpoint of descriptor.checkpoints) {
    if (completed.has(checkpoint.id)) continue;
    try {
      await client.query('BEGIN');
      await setDeadlines(client);
      for (const sql of checkpoint.sql) {
        if (options.failCheckpoint === checkpoint.id) throw Object.assign(new Error('fixture'), {code: '42P01'});
        await client.query(sql);
        sqlCount += 1;
      }
      await insertHistory(client, descriptor, checkpoint.id, 'checkpoint-applied');
      await client.query('COMMIT');
    } catch (cause) {
      await client.query('ROLLBACK').catch(() => {});
      diagnostics.push(diagnostic('E_MIGRATION_TRANSACTION_FAILED', 'apply', 'checkpoint', {
        ownerId: descriptor.ownerId, migrationId: descriptor.migrationId,
        checkpointId: checkpoint.id, cause,
      }));
      break;
    }
  }
  return {diagnostics, sqlCount};
}

async function setDeadlines(client) {
  await client.query(`SET LOCAL statement_timeout = '${BUDGETS.migrationDeadlineMs}ms'`);
  await client.query(`SET LOCAL lock_timeout = '${BUDGETS.lockDeadlineMs}ms'`);
  await client.query(`SET LOCAL transaction_timeout = '${BUDGETS.migrationDeadlineMs}ms'`);
}

async function insertHistory(client, descriptor, checkpointId, state) {
  await client.query(`
    INSERT INTO blankspace_migrations.applied_migrations
      (owner_id, migration_id, content_sha256, mode, state, checkpoint_id)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [descriptor.ownerId, descriptor.migrationId, descriptor.contentSha256, descriptor.mode, state, checkpointId]);
}

async function historyFor(client, descriptor) {
  const result = await client.query(`
    SELECT owner_id, migration_id, content_sha256, mode, state, checkpoint_id
    FROM blankspace_migrations.applied_migrations
    WHERE owner_id = $1 AND migration_id = $2 ORDER BY checkpoint_id
  `, [descriptor.ownerId, descriptor.migrationId]);
  return result.rows;
}

async function readHistory(client) {
  const result = await client.query(`
    SELECT owner_id, migration_id, content_sha256, mode, state, checkpoint_id
    FROM blankspace_migrations.applied_migrations ORDER BY owner_id, migration_id, checkpoint_id
  `);
  return result.rows;
}

function failedLock(plan) {
  return {
    ok: false, plan, history: [], sqlCount: 0,
    diagnostics: [diagnostic('E_MIGRATION_LOCK_UNAVAILABLE', 'lock', 'try-advisory-lock')],
  };
}
