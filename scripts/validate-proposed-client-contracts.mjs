import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';
import { hashCanonical } from '../spikes/s1-config/jsonc.mjs';

const root = resolve(import.meta.dirname, '..');
const schemaDirectory = join(root, 'docs', 'schemas', 'proposed', 'client-runtime');
const fixtureDirectory = join(schemaDirectory, 'fixtures');
const ajv = new Ajv2020({ strict: true, validateFormats: false });
ajv.addKeyword({ keyword: 'x-semanticConstraints', schemaType: 'array' });
ajv.addKeyword({ keyword: 'x-canonicalization', schemaType: 'array' });

function unique(values) {
  return new Set(values).size === values.length;
}

function compareUtf8Fields(left, right, fields) {
  for (const field of fields) {
    const compared = Buffer.compare(Buffer.from(String(left[field]), 'utf8'), Buffer.from(String(right[field]), 'utf8'));
    if (compared !== 0) return compared;
  }
  return 0;
}

function selectorsOverlap(left, right) {
  if (!left.platforms.some(platform => right.platforms.includes(platform))) return false;
  for (const field of ['runtime', 'uiFamily']) {
    if (left[field] && right[field] && JSON.stringify(left[field]) !== JSON.stringify(right[field])) return false;
  }
  return true;
}

function semanticErrors(schema, document) {
  const errors = [];
  if (schema === 'distribution-manifest.schema.json') {
    if (!unique(document.artifacts.map(item => item.id))) errors.push('duplicate artifact id');
    if (document.artifacts.some(item => item.contractHash !== document.contractHash)) errors.push('artifact contract hash mismatch');
    if (document.artifacts.some(item => item.coordinate.kind !== item.ecosystem)) errors.push('coordinate/ecosystem mismatch');
    for (let left = 0; left < document.artifacts.length; left += 1) {
      for (let right = left + 1; right < document.artifacts.length; right += 1) {
        const a = document.artifacts[left];
        const b = document.artifacts[right];
        if (a.role === b.role && a.ecosystem === b.ecosystem && selectorsOverlap(a.selector, b.selector)) errors.push('overlapping artifact selector');
      }
    }
  }
  if (schema === 'product-graph-v2.schema.json') {
    const keys = document.nodes.map(node => node.key);
    if (!unique(keys)) errors.push('duplicate node key');
    if (document.nodes.some(node => node.key !== `${node.kind}:${node.id}:${node.version}:${node.contentHash}`)) errors.push('invalid node key');
    if (document.nodes.some(node => node.data.factType !== node.kind)) errors.push('node kind/data mismatch');
    const keySet = new Set(keys);
    if (document.edges.some(edge => !keySet.has(edge.from) || !keySet.has(edge.to))) errors.push('dangling edge');
    const sortedNodes = [...document.nodes].sort((a, b) => compareUtf8Fields(a, b, ['kind', 'id', 'version', 'contentHash']));
    if (JSON.stringify(sortedNodes) !== JSON.stringify(document.nodes)) errors.push('nodes are not canonical order');
    const sortedEdges = [...document.edges].sort((a, b) => compareUtf8Fields(a, b, ['from', 'to', 'kind']));
    if (JSON.stringify(sortedEdges) !== JSON.stringify(document.edges)) errors.push('edges are not canonical order');
    const { assemblyId, ...hashInput } = document;
    if (assemblyId !== `sha256:${hashCanonical(hashInput)}`) errors.push('assemblyId mismatch');
  }
  if (schema === 'tool-protocol.schema.json' && document.kind === 'request') {
    const expectedRoot = `.blankspace/generated/${document.clientId}/${document.operation}`;
    if (document.outputRoot !== expectedRoot) errors.push('outputRoot is not assigned client/operation root');
    const inputPaths = document.inputs.map(input => input.path);
    if (!unique(inputPaths)) errors.push('duplicate input path');
    const sorted = [...inputPaths].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
    if (JSON.stringify(inputPaths) !== JSON.stringify(sorted)) errors.push('inputs are not canonical order');
  }
  if (schema === 'product-clients-v2.schema.json') {
    if (!unique(document.clients.map(client => client.id))) errors.push('duplicate client id');
  }
  return errors;
}

let passed = 0;
const validators = new Map();
for (const name of readdirSync(fixtureDirectory).filter(file => file.endsWith('.json')).sort()) {
  const fixture = JSON.parse(readFileSync(join(fixtureDirectory, name), 'utf8'));
  if (!validators.has(fixture.schema)) {
    const schema = JSON.parse(readFileSync(join(schemaDirectory, fixture.schema), 'utf8'));
    validators.set(fixture.schema, ajv.compile(schema));
  }
  const validate = validators.get(fixture.schema);
  const schemaValid = validate(fixture.document);
  const errors = schemaValid ? semanticErrors(fixture.schema, fixture.document) : [];
  const actual = schemaValid && errors.length === 0;
  if (actual !== fixture.valid) {
    const details = schemaValid ? errors.join(', ') : ajv.errorsText(validate.errors);
    throw new Error(`${name}: expected valid=${fixture.valid}, got ${actual}: ${details}`);
  }
  passed += 1;
}

console.log(`validated ${passed} proposed client contract fixtures`);
