export class ArtifactTraceReconciliationError extends Error {
  constructor(code, artifactIds) {
    const kind = code === 'E_BUNDLE_ARTIFACT_MISSING' ? 'missing' : 'unexpected';
    super(`${code} artifacts: ${kind} artifact(s): ${artifactIds.join(', ')}.`);
    this.name = 'ArtifactTraceReconciliationError';
    this.code = code;
    this.path = 'artifacts';
    this.artifactIds = artifactIds;
  }
}

export function artifactIdentity(artifact) {
  return `${artifact.kind}:${artifact.sourceIdentity}`;
}

export function reconcileArtifactTrace(expected, actual) {
  const expectedIds = new Set(expected.map(artifactIdentity));
  const actualIds = new Set(actual.map(artifactIdentity));

  const missing = [...expectedIds].filter(id => !actualIds.has(id)).sort();
  if (missing.length > 0) {
    throw new ArtifactTraceReconciliationError('E_BUNDLE_ARTIFACT_MISSING', missing);
  }

  const extra = [...actualIds].filter(id => !expectedIds.has(id)).sort();
  if (extra.length > 0) {
    throw new ArtifactTraceReconciliationError('E_BUNDLE_ARTIFACT_EXTRA', extra);
  }

  return { expectedCount: expectedIds.size, actualCount: actualIds.size };
}
