import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';

const root = resolve(import.meta.dirname, '..');
const releaseRoot = join(root, 'docs', 'schemas', 'proposed', 'release');
const fixtureRoot = join(releaseRoot, 'fixtures');
const ajv = new Ajv2020({ strict: true });
ajv.addKeyword({ keyword: 'x-semanticConstraints', schemaType: 'array' });
ajv.addFormat('uri', value => {
  try { return new URL(value).protocol.length > 1; } catch { return false; }
});
ajv.addFormat('date-time', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/);

const publishingActions = new Set(['sign', 'notarize', 'publish', 'deploy', 'promote']);
const nativeRunner = new Map([
  ['macos-arm64', 'macos'], ['macos-x64', 'macos'], ['ios', 'macos'],
  ['windows-x64', 'windows'], ['android', 'linux'],
  ['linux-amd64', 'linux'], ['linux-arm64', 'linux'], ['web', 'linux']
]);
const distributionEvidence = new Map([
  ['internal', ['digest', 'tests', 'provenance', 'compatibility']],
  ['oci', ['digest', 'tests', 'sbom', 'provenance', 'signature', 'compatibility']],
  ['desktop-update', ['digest', 'tests', 'sbom', 'provenance', 'signature', 'compatibility']],
  ['app-store', ['digest', 'tests', 'sbom', 'provenance', 'signature', 'notarization', 'compatibility']],
  ['play-store', ['digest', 'tests', 'sbom', 'provenance', 'signature', 'compatibility']]
]);
const lifecycleEdges = new Set([
  'planned>building', 'building>verified', 'verified>signed', 'verified>candidate',
  'signed>candidate', 'candidate>staged', 'candidate>submitted', 'candidate>available',
  'staged>rolling-out', 'staged>available', 'submitted>approved',
  'approved>rolling-out', 'approved>available', 'rolling-out>available',
  'available>halted', 'rolling-out>halted'
]);
const receiptStates = new Set(['staged', 'submitted', 'approved', 'rolling-out', 'available', 'halted', 'revoked']);

function lifecycleErrors(document) {
  const errors = [];
  const targetIds = document.targets.map(target => target.id);
  if (new Set(targetIds).size !== targetIds.length) errors.push('duplicate target ID');
  const targets = new Map(document.targets.map(target => [target.id, target]));
  const histories = new Map(targetIds.map(id => [id, []]));
  for (const transition of document.transitions) {
    const target = targets.get(transition.targetId);
    if (!target) errors.push('dangling lifecycle target');
    const terminalEscape = transition.to === 'failed' || transition.to === 'revoked';
    if (!terminalEscape && !lifecycleEdges.has(`${transition.from}>${transition.to}`)) errors.push('invalid lifecycle transition');
    if (target && transition.artifactDigest !== target.artifactDigest) errors.push('lifecycle artifact digest mismatch');
    if (receiptStates.has(transition.to) && !transition.externalReceipt) errors.push('missing external receipt');
    histories.get(transition.targetId)?.push(transition);
  }
  for (const target of document.targets) {
    const history = histories.get(target.id);
    for (let index = 1; index < history.length; index += 1) {
      if (history[index - 1].to !== history[index].from) errors.push('discontinuous lifecycle history');
      if (history[index - 1].at > history[index].at) errors.push('non-monotonic lifecycle time');
      if (['failed', 'revoked'].includes(history[index - 1].to)) errors.push('transition after terminal state');
    }
    if (history.length > 0 && history.at(-1).to !== target.state) errors.push('target state does not match history');
  }
  return errors;
}

function candidateErrors(document) {
  const errors = [];
  const artifactIds = document.artifacts.map(artifact => artifact.id);
  if (new Set(artifactIds).size !== artifactIds.length) errors.push('duplicate candidate artifact ID');
  const targets = new Set(document.artifacts.map(artifact => artifact.target));
  if (document.policy.mandatoryTargets.some(target => !targets.has(target))) errors.push('missing mandatory target');
  for (const artifact of document.artifacts) {
    const subjects = new Set([artifact.unsigned.digest, artifact.distributed.digest]);
    if (artifact.evidence.some(evidence => !subjects.has(evidence.subjectDigest))) errors.push('evidence subject mismatch');
    const kinds = new Set(artifact.evidence.map(evidence => evidence.kind));
    if (['tests', 'sbom', 'provenance', 'signature'].some(kind => !kinds.has(kind))) errors.push('missing artifact evidence');
  }
  const distributedDigests = new Set(document.artifacts.map(artifact => artifact.distributed.digest));
  if (!distributedDigests.has(document.compatibility.subjectDigest)) errors.push('compatibility subject mismatch');
  return errors;
}

function semanticErrors(document) {
  const errors = [];
  const jobIds = document.jobs.map(job => job.id);
  const artifactIds = document.artifacts.map(artifact => artifact.id);
  if (new Set(jobIds).size !== jobIds.length) errors.push('duplicate job ID');
  if (new Set(artifactIds).size !== artifactIds.length) errors.push('duplicate artifact ID');

  const jobs = new Map(document.jobs.map(job => [job.id, job]));
  if (!document.invocation.sourceTrusted && document.jobs.some(job => job.trust === 'protected')) {
    errors.push('untrusted source reaches protected job');
  }
  if (document.jobs.some(job => job.needs.some(id => !jobs.has(id)))) errors.push('dangling job dependency');
  if (document.artifacts.some(artifact => !jobs.has(artifact.producerJob))) errors.push('dangling artifact producer');

  for (const job of document.jobs) {
    const visit = (id, path) => {
      if (path.has(id)) return true;
      const next = jobs.get(id);
      if (!next) return false;
      const branch = new Set(path).add(id);
      return next.needs.some(dependency => visit(dependency, branch));
    };
    if (visit(job.id, new Set())) {
      errors.push('job dependency cycle');
      break;
    }
  }

  for (const job of document.jobs) {
    if (job.kind === 'promote' && job.actions.some(action => action === 'compile' || action === 'package')) {
      errors.push('promotion rebuild');
    }
    if (job.trust === 'untrusted' && (job.usesSecrets || job.actions.some(action => publishingActions.has(action)))) {
      errors.push('untrusted publishing authority');
    }
  }

  for (const artifact of document.artifacts) {
    const producer = jobs.get(artifact.producerJob);
    if (producer && nativeRunner.get(artifact.platform) !== producer.runner) errors.push('incompatible artifact runner');
    if (artifact.sourceRevision !== document.sourceRevision || artifact.inputHash !== document.inputHash) {
      errors.push('artifact input identity mismatch');
    }
    const evidence = new Set(artifact.requiredEvidence);
    if (distributionEvidence.get(artifact.distribution).some(item => !evidence.has(item))) {
      errors.push('missing distribution evidence');
    }
  }
  return errors;
}

let passed = 0;
const validators = new Map();
for (const name of readdirSync(fixtureRoot).filter(file => file.endsWith('.json')).sort()) {
  const fixture = JSON.parse(readFileSync(join(fixtureRoot, name), 'utf8'));
  const schemaPath = join(dirname(fixtureRoot), fixture.schema);
  if (!validators.has(schemaPath)) validators.set(schemaPath, ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8'))));
  const validate = validators.get(schemaPath);
  const schemaValid = validate(fixture.document);
  let errors = [];
  if (schemaValid) {
    if (fixture.document.kind === 'release-lifecycle') errors = lifecycleErrors(fixture.document);
    else if (fixture.document.kind === 'release-candidate') errors = candidateErrors(fixture.document);
    else errors = semanticErrors(fixture.document);
  }
  const actual = schemaValid && errors.length === 0;
  if (actual !== fixture.valid) {
    const details = schemaValid ? errors.join(', ') : ajv.errorsText(validate.errors);
    throw new Error(`${name}: expected valid=${fixture.valid}, got ${actual}: ${details}`);
  }
  passed += 1;
}

console.log(`validated ${passed} proposed release contract fixtures`);
