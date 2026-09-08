import {createHash} from 'node:crypto';

export const IMAGE = 'postgres:18.6-bookworm@sha256:1c59e2c3c818eaa0f0628f695b36e7c9e362d6b219b36a54a32df645cbd7e1af';
export const IMAGE_DIGEST = 'sha256:1c59e2c3c818eaa0f0628f695b36e7c9e362d6b219b36a54a32df645cbd7e1af';
export const IMAGE_RUNTIME = `postgres@${IMAGE_DIGEST}`;
export const DATABASE = 'blankspace_s7';
export const USER = 'blankspace_runner';
export const LOCK_KEYS = [1112755527, 1];

export const BUDGETS = Object.freeze({
  containerStartupDeadlineMs: 60_000,
  connectionDeadlineMs: 5_000,
  statementDeadlineMs: 2_000,
  lockDeadlineMs: 2_000,
  migrationDeadlineMs: 15_000,
  harnessDeadlineMs: 120_000,
});

export const SCENARIO_IDS = Object.freeze([
  'typed-query-equivalence',
  'stable-two-owner-order',
  'duplicate-migration-id',
  'dependency-failure',
  'applied-hash-mismatch',
  'concurrent-runners',
  'transactional-rollback',
  'checkpoint-resume',
  'manual-plan-block',
  'owner-scope-rejection',
  'removal-retains-data',
  'bounded-failures',
  'explain-index-evidence',
  'client-import-boundary',
]);

export const FIXTURE = Object.freeze({
  alphaRows: [
    {itemId: '00000000-0000-4000-8000-000000000001', label: 'alpha-one', revision: 0},
    {itemId: '00000000-0000-4000-8000-000000000002', label: 'alpha-two', revision: 1},
  ],
  betaRows: [
    {linkId: '10000000-0000-4000-8000-000000000001', alphaItemId: '00000000-0000-4000-8000-000000000001', kind: 'reference'},
    {linkId: '10000000-0000-4000-8000-000000000002', alphaItemId: '00000000-0000-4000-8000-000000000002', kind: 'reference'},
  ],
});

const CAUSE_ALLOWLIST = new Set(['23505', '42P01', '42501', '55P03', '57014', 'ECONNREFUSED', 'ECONNRESET']);

export function diagnostic(code, phase, operation, details = {}) {
  const value = {
    code,
    severity: 'error',
    phase,
    ownerId: details.ownerId ?? 'runner',
    operation,
    message: details.message ?? stableMessage(code),
  };
  for (const key of ['migrationId', 'checkpointId', 'schema', 'deadlineMs']) {
    if (details[key] !== undefined) value[key] = details[key];
  }
  const causeCode = details.causeCode ?? details.cause?.code;
  if (CAUSE_ALLOWLIST.has(causeCode)) value.causeCode = causeCode;
  if (details.pendingOwners) value.pendingOwners = [...details.pendingOwners].sort();
  return value;
}

function stableMessage(code) {
  const messages = {
    E_DB_CONNECT: 'Database connection failed within the configured boundary.',
    E_DB_STATEMENT: 'Database statement failed.',
    E_DB_STATEMENT_TIMEOUT: 'Database statement exceeded its deadline.',
    E_MIGRATION_DUPLICATE_ID: 'Migration identifiers must be unique per owner.',
    E_MIGRATION_DEPENDENCY: 'Migration dependencies cannot be resolved.',
    E_MIGRATION_HASH_MISMATCH: 'Applied migration content hash does not match.',
    E_MIGRATION_LOCK_UNAVAILABLE: 'Migration runner lock is already held.',
    E_MIGRATION_TRANSACTION_FAILED: 'Transactional migration was rolled back.',
    E_MIGRATION_CHECKPOINT_INVALID: 'Checkpointed migration is invalid.',
    E_MIGRATION_MANUAL_REQUIRED: 'Manual migration requires complete recovery metadata.',
    E_MIGRATION_OWNER_SCOPE: 'Migration SQL targets a schema outside its owner scope.',
    E_MIGRATION_DEADLINE: 'Migration exceeded its deadline.',
  };
  return messages[code] ?? 'S7 conformance failure.';
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex');
}

export function descriptorHash(descriptor) {
  const {contentSha256: _ignored, ...body} = descriptor;
  return sha256(body);
}
