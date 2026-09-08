import {descriptorHash, diagnostic} from './constants.mjs';

export function makeDescriptor(input) {
  const descriptor = {
    ownerId: input.ownerId,
    migrationId: input.migrationId,
    dependsOn: input.dependsOn ?? [],
    mode: input.mode ?? 'transactional',
    contentSha256: '',
    sql: input.sql ?? [],
    recoveryOwner: input.recoveryOwner ?? input.ownerId,
    runbookRef: input.runbookRef ?? 'docs/spikes/S7-database.md',
    compatibleAppRange: input.compatibleAppRange ?? '>=0.0.0',
  };
  if (input.checkpoints !== undefined) descriptor.checkpoints = input.checkpoints;
  if (input.backupEvidenceRef !== undefined) descriptor.backupEvidenceRef = input.backupEvidenceRef;
  descriptor.contentSha256 = descriptorHash(descriptor);
  return descriptor;
}

export function planMigrations(descriptors) {
  const byKey = new Map();
  for (const descriptor of descriptors) {
    const key = migrationKey(descriptor);
    if (byKey.has(key)) return failure('E_MIGRATION_DUPLICATE_ID', descriptor, 'deduplicate');
    const manualProblem = validateManual(descriptor);
    if (manualProblem) return failure('E_MIGRATION_MANUAL_REQUIRED', descriptor, manualProblem);
    const checkpointProblem = validateCheckpoints(descriptor);
    if (checkpointProblem) return failure('E_MIGRATION_CHECKPOINT_INVALID', descriptor, checkpointProblem);
    const scope = validateOwnerScope(descriptor);
    if (scope) return failure('E_MIGRATION_OWNER_SCOPE', descriptor, 'validate-owner', {schema: scope});
    byKey.set(key, descriptor);
  }

  const dependencies = new Map();
  for (const descriptor of descriptors) {
    const resolved = descriptor.dependsOn.map((dependency) => resolveDependency(descriptor, dependency));
    if (resolved.some((key) => !byKey.has(key))) {
      return failure('E_MIGRATION_DEPENDENCY', descriptor, 'resolve-dependency', {
        pendingOwners: [descriptor.ownerId],
      });
    }
    dependencies.set(migrationKey(descriptor), new Set(resolved));
  }

  const ordered = [];
  while (ordered.length < descriptors.length) {
    const ready = [...byKey.keys()]
      .filter((key) => !ordered.includes(key))
      .filter((key) => [...dependencies.get(key)].every((dependency) => ordered.includes(dependency)))
      .sort();
    if (ready.length === 0) {
      const pendingOwners = [...byKey.keys()]
        .filter((key) => !ordered.includes(key)).map((key) => byKey.get(key).ownerId);
      return {ok: false, plan: [], diagnostics: [diagnostic(
        'E_MIGRATION_DEPENDENCY', 'plan', 'topological-sort', {pendingOwners: [...new Set(pendingOwners)]},
      )]};
    }
    ordered.push(...ready);
  }
  return {ok: true, plan: ordered.map((key) => byKey.get(key)), diagnostics: []};
}

function migrationKey(descriptor) {
  return `${descriptor.ownerId}/${descriptor.migrationId}`;
}

function resolveDependency(descriptor, dependency) {
  return dependency.includes('/') ? dependency : `${descriptor.ownerId}/${dependency}`;
}

function validateManual(descriptor) {
  if (descriptor.mode !== 'manual') return undefined;
  if (!descriptor.recoveryOwner) return 'recovery-owner';
  if (!descriptor.runbookRef) return 'runbook';
  if (!descriptor.compatibleAppRange) return 'compatible-range';
  if (!descriptor.backupEvidenceRef) return 'backup-evidence';
  return undefined;
}

function validateCheckpoints(descriptor) {
  if (descriptor.mode !== 'checkpointed') return undefined;
  if (!descriptor.checkpoints?.length) return 'checkpoints-required';
  const identifiers = descriptor.checkpoints.map((checkpoint) => checkpoint.id);
  if (new Set(identifiers).size !== identifiers.length) return 'checkpoint-id-unique';
  if (descriptor.checkpoints.some((checkpoint) => !checkpoint.id || checkpoint.sql.length === 0)) return 'checkpoint-content';
  return undefined;
}

export function validateOwnerScope(descriptor) {
  const allowed = `kit_${descriptor.ownerId}`;
  const statements = [...descriptor.sql, ...(descriptor.checkpoints ?? []).flatMap((checkpoint) => checkpoint.sql)];
  for (const statement of statements) {
    for (const match of statement.matchAll(/\b(kit_[a-z][a-z0-9_]*|public|blankspace_migrations)\s*\./gi)) {
      if (match[1].toLowerCase() !== allowed) return match[1].toLowerCase();
    }
  }
  return undefined;
}

function failure(code, descriptor, operation, details = {}) {
  return {ok: false, plan: [], diagnostics: [diagnostic(code, 'plan', operation, {
    ownerId: descriptor.ownerId,
    migrationId: descriptor.migrationId,
    ...details,
  })]};
}
