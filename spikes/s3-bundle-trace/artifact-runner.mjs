import { reconcileArtifactTrace } from './artifact-reconcile.mjs';
import { observeViteArtifacts } from './artifact-vite.mjs';

const expectedArtifacts = [
  ['css', 'packages/app/src/artifact-style.css'],
  ['worker', 'packages/app/src/artifact-worker.ts'],
  ['wasm', 'packages/app/src/artifact-module.wasm'],
  ['asset', 'packages/app/src/artifact-logo.svg'],
  ['virtual-module', 'virtual:blankspace-s3'],
].map(([kind, sourceIdentity]) => ({ kind, sourceIdentity }));

export async function runArtifactTrace(root) {
  const artifacts = await observeViteArtifacts(root);
  artifacts.sort((a, b) => `${a.kind}:${a.sourceIdentity}`.localeCompare(`${b.kind}:${b.sourceIdentity}`));
  reconcileArtifactTrace(expectedArtifacts, artifacts);
  return artifacts;
}

export { expectedArtifacts };
