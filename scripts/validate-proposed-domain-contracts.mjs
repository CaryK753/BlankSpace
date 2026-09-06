import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

import Ajv2020 from 'ajv/dist/2020.js';

const root = resolve(import.meta.dirname, '..');
const proposedRoot = join(root, 'docs', 'schemas', 'proposed');
const fixtureDirectories = [
  join(proposedRoot, 'editor', 'fixtures'),
  join(proposedRoot, 'sync', 'fixtures'),
];
const ajv = new Ajv2020({ strict: true, validateFormats: false });
ajv.addKeyword({ keyword: 'x-semanticConstraints', schemaType: 'array' });
ajv.addKeyword({ keyword: 'x-canonicalization', schemaType: 'array' });

function semanticErrors(schemaName, document) {
  const errors = [];
  if (schemaName === 'editor-engine-v1.schema.json' && document.kind === 'editor-transaction-receipt') {
    if (document.resultRevision <= document.baseRevision) errors.push('resultRevision must be greater than baseRevision');
  }
  if (schemaName === 'editor-engine-v1.schema.json' && document.kind === 'editor-engine-manifest') {
    const names = document.operations.map(operation => operation.name);
    const required = ['create', 'open', 'close', 'snapshot', 'transaction', 'observe', 'import', 'export', 'index-project'];
    if (new Set(names).size !== names.length) errors.push('duplicate operation descriptor');
    if (required.some(name => names.filter(candidate => candidate === name).length !== 1)) errors.push('missing or duplicate required operation');
    const extensionIds = document.extensions.map(extension => extension.id);
    if (new Set(extensionIds).size !== extensionIds.length) errors.push('duplicate extension identity');
    const extensionSet = new Set(extensionIds);
    if (document.extensions.some(extension => extension.requiredExtensions.some(id => !extensionSet.has(id)))) errors.push('dangling extension dependency');
    for (const extension of document.extensions) {
      if (new Set(extension.contentKinds.map(kind => kind.id)).size !== extension.contentKinds.length) errors.push('duplicate content kind identity');
      if (new Set(extension.commands.map(command => command.id)).size !== extension.commands.length) errors.push('duplicate command identity');
    }
    const dependencies = new Map(document.extensions.map(extension => [extension.id, extension.requiredExtensions]));
    const visiting = new Set();
    const visited = new Set();
    function visit(id) {
      if (visiting.has(id)) return true;
      if (visited.has(id)) return false;
      visiting.add(id);
      if ((dependencies.get(id) ?? []).some(visit)) return true;
      visiting.delete(id);
      visited.add(id);
      return false;
    }
    if (extensionIds.some(visit)) errors.push('cyclic extension dependency');
  }
  if (schemaName === 'sync-protocol-v1.schema.json' && document.kind === 'sync-change-batch') {
    const sequences = document.operations.map(operation => operation.clientSequence);
    if (document.firstSequence !== sequences[0] || document.lastSequence !== sequences.at(-1)) errors.push('batch boundary does not match operations');
    if (sequences.some((value, index) => index > 0 && value !== sequences[index - 1] + 1)) errors.push('operation sequences are not contiguous');
    const identities = document.operations.map(operation => `${operation.workspace.sourceId}/${operation.workspace.workspaceId}/${operation.dataDomain}/${operation.operationId}`);
    if (new Set(identities).size !== identities.length) errors.push('duplicate operation identity');
    for (const operation of document.operations) {
      const payload = Buffer.from(operation.payloadBase64, 'base64');
      const hash = `sha256:${createHash('sha256').update(payload).digest('hex')}`;
      if (payload.length !== operation.payloadBytes) errors.push('payloadBytes does not match decoded payload');
      if (hash !== operation.payloadHash) errors.push('payloadHash does not match decoded payload');
    }
  }
  if (schemaName === 'sync-protocol-v1.schema.json' && document.kind === 'sync-batch-result') {
    const identities = document.results.map(result => result.operationId);
    if (new Set(identities).size !== identities.length) errors.push('duplicate operation result');
  }
  if (schemaName === 'sync-protocol-v1.schema.json' && document.kind === 'sync-blob-chunk') {
    const decoded = Buffer.from(document.payloadBase64, 'base64');
    if (decoded.length !== document.chunkBytes) errors.push('chunkBytes does not match decoded payload');
    const hash = `sha256:${createHash('sha256').update(decoded).digest('hex')}`;
    if (hash !== document.chunkHash) errors.push('chunkHash does not match decoded payload');
    if (document.chunkCount === 1 && hash !== document.contentHash) errors.push('single chunk contentHash does not match decoded payload');
  }
  if (schemaName === 'sync-protocol-v1.schema.json' && document.kind === 'sync-blob-transfer') {
    const indexes = document.chunks.map(chunk => chunk.chunkIndex);
    if (indexes.some((value, index) => value !== index)) errors.push('blob chunks are missing, duplicated or out of order');
    const decoded = document.chunks.map(chunk => Buffer.from(chunk.payloadBase64, 'base64'));
    for (let index = 0; index < document.chunks.length; index += 1) {
      const hash = `sha256:${createHash('sha256').update(decoded[index]).digest('hex')}`;
      if (decoded[index].length !== document.chunks[index].chunkBytes) errors.push('blob transfer chunkBytes mismatch');
      if (hash !== document.chunks[index].chunkHash) errors.push('blob transfer chunkHash mismatch');
    }
    const content = Buffer.concat(decoded);
    const contentHash = `sha256:${createHash('sha256').update(content).digest('hex')}`;
    if (content.length !== document.totalBytes) errors.push('blob transfer totalBytes mismatch');
    if (contentHash !== document.contentHash) errors.push('blob transfer contentHash mismatch');
  }
  return errors;
}

let passed = 0;
const validators = new Map();
for (const fixtureDirectory of fixtureDirectories) {
  for (const name of readdirSync(fixtureDirectory).filter(file => file.endsWith('.json')).sort()) {
    const fixture = JSON.parse(readFileSync(join(fixtureDirectory, name), 'utf8'));
    const schemaPath = join(dirname(fixtureDirectory), fixture.schema);
    if (!validators.has(schemaPath)) validators.set(schemaPath, ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8'))));
    const validate = validators.get(schemaPath);
    const schemaValid = validate(fixture.document);
    const errors = schemaValid ? semanticErrors(basename(schemaPath), fixture.document) : [];
    const actual = schemaValid && errors.length === 0;
    if (actual !== fixture.valid) {
      const details = schemaValid ? errors.join(', ') : ajv.errorsText(validate.errors);
      throw new Error(`${name}: expected valid=${fixture.valid}, got ${actual}: ${details}`);
    }
    passed += 1;
  }
}

console.log(`validated ${passed} proposed editor/sync contract fixtures`);
