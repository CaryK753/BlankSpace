import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';
import { parseJsonc } from '../spikes/s1-config/jsonc.mjs';

const root = resolve(import.meta.dirname, '..');
const failures = [];
let jsoncExamples = 0;
let schemaExamples = 0;

function configuredAjv() {
  const ajv = new Ajv2020({ strict: true });
  ajv.addFormat('uri', value => {
    try { return new URL(value).protocol.length > 1; } catch { return false; }
  });
  ajv.addFormat('date-time', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/);
  return ajv;
}

function filesUnder(directory) {
  const result = [];
  for (const name of readdirSync(directory).sort()) {
    if (name === '.git' || name === 'node_modules') continue;
    const path = join(directory, name);
    if (statSync(path).isDirectory()) result.push(...filesUnder(path));
    else result.push(path);
  }
  return result;
}

function repositoryPath(path) {
  return relative(root, path).split(sep).join('/');
}

function record(scope, error) {
  const message = error instanceof Error ? error.message : String(error);
  failures.push(`${scope}: ${message}`);
}

function verifyJson(files) {
  for (const path of files.filter(file => extname(file) === '.json')) {
    try {
      JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      record(repositoryPath(path), error);
    }
  }
}

function verifyProposedSchemas() {
  const directory = join(root, 'docs', 'schemas', 'proposed');
  const ajv = configuredAjv();
  ajv.addKeyword({ keyword: 'x-semanticConstraints', schemaType: 'array' });
  ajv.addKeyword({ keyword: 'x-canonicalization', schemaType: 'array' });
  let count = 0;
  for (const path of filesUnder(directory).filter(file => file.endsWith('.schema.json')).sort()) {
    try {
      ajv.compile(JSON.parse(readFileSync(path, 'utf8')));
      count += 1;
    } catch (error) {
      record(repositoryPath(path), error);
    }
  }
  return count;
}

function formalSchemaValidators() {
  const directory = join(root, 'packages', 'contracts', 'schemas');
  const ajv = configuredAjv();
  const schemas = filesUnder(directory).filter(file => file.endsWith('.json')).map(path => ({
    path,
    schema: JSON.parse(readFileSync(path, 'utf8')),
  }));
  for (const item of schemas) ajv.addSchema(item.schema);
  return new Map(schemas.map(item => [item.path.split(sep).at(-1), ajv.getSchema(item.schema.$id)]));
}

function normalizedStatus(value) {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

function verifyProjectStatus() {
  const directory = join(root, 'docs', 'status');
  const schema = JSON.parse(readFileSync(join(directory, 'project-status.schema.json'), 'utf8'));
  const document = JSON.parse(readFileSync(join(directory, 'project-status.json'), 'utf8'));
  const validate = configuredAjv().compile(schema);
  if (!validate(document)) record('docs/status/project-status.json', new Error(validate.errors?.map(error => `${error.instancePath} ${error.message}`).join('; ')));
  return document;
}

function verifySpikeStatus(document) {
  const indexPath = join(root, 'docs', 'spikes', 'README.md');
  const index = readFileSync(indexPath, 'utf8');
  const date = index.match(/更新时间：(\d{4}-\d{2}-\d{2})/u)?.[1];
  if (date !== document.updatedAt) record('docs/spikes/README.md', new Error(`updated date ${date ?? 'missing'} differs from project status ${document.updatedAt}`));

  const files = {
    s1: 'S1-config.md', s2: 'S2-resolver.md', s3: 'S3-bundle-trace.md', s4: 'S4-registry.md',
    s5: 'S5-lifecycle.md', s6: 'S6-server.md', s7: 'S7-database.md', s8: 'S8-ui.md',
    cr1: 'CR1-client-runtime.md', ds1: 'DS1-design-system.md', sc1: 'SC1-release-integrity.md',
    n1: 'N1-native-storage-sync.md', e1: 'E1-editor-boundary.md', y1: 'Y1-sync-protocol.md',
  };
  for (const [id, file] of Object.entries(files)) {
    const expected = document.spikes[id].status;
    const row = index.split(/\r?\n/).find(line => line.includes(`](${file})`));
    const displayed = row?.split('|')[2];
    if (!displayed || normalizedStatus(displayed) !== expected) {
      record('docs/spikes/README.md', new Error(`${id} status ${displayed?.trim() ?? 'missing'} differs from ${expected}`));
    }
    const spike = readFileSync(join(root, 'docs', 'spikes', file), 'utf8').slice(0, 800);
    const statusWords = spike.match(/\b(Not started|Draft matrix|Matrix frozen|Provisional pass|Pass|Failed)\b/i)?.[1];
    if (!statusWords || normalizedStatus(statusWords) !== expected) {
      record(`docs/spikes/${file}`, new Error(`declared status ${statusWords ?? 'missing'} differs from ${expected}`));
    }
  }
}

function verifyWorkItems(projectStatus) {
  const directory = join(root, 'docs', 'implementation');
  const schema = JSON.parse(readFileSync(join(directory, 'phase-1a-work-items.schema.json'), 'utf8'));
  const document = JSON.parse(readFileSync(join(directory, 'phase-1a-work-items.json'), 'utf8'));
  const ajv = configuredAjv();
  ajv.addKeyword({ keyword: 'x-semanticConstraints', schemaType: 'array' });
  const validate = ajv.compile(schema);
  if (!validate(document)) {
    record('docs/implementation/phase-1a-work-items.json', new Error(validate.errors?.map(error => `${error.instancePath} ${error.message}`).join('; ')));
    return { count: 0, actionable: 'invalid' };
  }

  const ids = document.items.map(item => item.id);
  if (new Set(ids).size !== ids.length) record('docs/implementation/phase-1a-work-items.json', new Error('duplicate work item ID'));
  const items = new Map(document.items.map(item => [item.id, item]));
  const actionable = document.items.filter(item => item.status === 'ready' || item.status === 'in-progress');
  if (actionable.length !== 1) record('docs/implementation/phase-1a-work-items.json', new Error(`expected exactly one actionable item, found ${actionable.length}`));
  if (actionable[0]?.id !== projectStatus.nextWorkItem) record('docs/status/project-status.json', new Error(`nextWorkItem ${projectStatus.nextWorkItem} differs from actionable item ${actionable[0]?.id ?? 'missing'}`));

  for (const item of document.items) {
    for (const dependency of item.dependsOn) {
      if (!items.has(dependency)) record('docs/implementation/phase-1a-work-items.json', new Error(`${item.id} has missing dependency ${dependency}`));
    }
    if ((item.status === 'ready' || item.status === 'in-progress') && item.dependsOn.some(id => items.get(id)?.status !== 'done')) {
      record('docs/implementation/phase-1a-work-items.json', new Error(`${item.id} is actionable before dependencies are done`));
    }
    for (const reference of item.references) {
      if (!existsSync(join(root, reference))) record('docs/implementation/phase-1a-work-items.json', new Error(`${item.id} has missing reference ${reference}`));
    }
    const visit = (id, path) => {
      if (path.has(id)) return true;
      const next = items.get(id);
      if (!next) return false;
      const branch = new Set(path).add(id);
      return next.dependsOn.some(dependency => visit(dependency, branch));
    };
    if (visit(item.id, new Set())) record('docs/implementation/phase-1a-work-items.json', new Error(`dependency cycle at ${item.id}`));
  }
  return { count: document.items.length, actionable: actionable[0]?.id ?? 'missing' };
}

function verifyBaseline() {
  const baseline = JSON.parse(readFileSync(join(root, 'rfc-baseline.json'), 'utf8'));
  const rfcDirectory = join(root, 'docs', 'rfcs');
  const actual = readdirSync(rfcDirectory)
    .filter(name => /^\d{4}-[a-z0-9-]+\.md$/.test(name))
    .sort()
    .map(name => `docs/rfcs/${name}`);
  const entries = Array.isArray(baseline.rfcs) ? baseline.rfcs : [];
  const listed = entries.map(entry => entry.path);

  if (baseline.schemaVersion !== '1') record('rfc-baseline.json', 'schemaVersion must be "1"');
  if (baseline.algorithm !== 'sha256-utf8-bytes') record('rfc-baseline.json', 'unsupported hash algorithm');
  if (baseline.selection !== 'all-numbered-rfcs') record('rfc-baseline.json', 'selection must be all-numbered-rfcs');
  if (new Set(listed).size !== listed.length) record('rfc-baseline.json', 'contains duplicate RFC paths');
  if (JSON.stringify(listed) !== JSON.stringify(actual)) {
    record('rfc-baseline.json', `RFC set/order differs from docs/rfcs: ${JSON.stringify(listed)} != ${JSON.stringify(actual)}`);
  }

  for (const entry of entries) {
    if (typeof entry?.path !== 'string' || !/^[a-f0-9]{64}$/.test(entry?.sha256 ?? '')) {
      record('rfc-baseline.json', `invalid entry ${JSON.stringify(entry)}`);
      continue;
    }
    const path = join(root, entry.path);
    if (!existsSync(path)) {
      record('rfc-baseline.json', `missing ${entry.path}`);
      continue;
    }
    const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
    if (hash !== entry.sha256) record('rfc-baseline.json', `hash mismatch for ${entry.path}: ${hash}`);
  }

  return actual.length;
}

function linkDestination(raw) {
  return raw.trim().replace(/^<|>$/g, '').split(/\s+(?=["'])/, 1)[0];
}

function verifyMarkdown(files, validators) {
  const markdown = files.filter(file => extname(file) === '.md');
  const linkPattern = /(?<!!)\[[^\]]*\]\(([^)]+)\)/g;
  const jsoncPattern = /```jsonc[^\n]*\n([\s\S]*?)\n```/g;

  for (const path of markdown) {
    const content = readFileSync(path, 'utf8');
    const fences = content.split(/\r?\n/).filter(line => line.trimStart().startsWith('```')).length;
    if (fences % 2 !== 0) record(repositoryPath(path), 'unbalanced fenced code block');

    for (const match of content.matchAll(linkPattern)) {
      const destination = linkDestination(match[1]);
      if (/^(?:https?:|mailto:|chatgpt-conversation:|#)/.test(destination)) continue;
      const filePart = destination.split('#', 1)[0];
      if (!filePart) continue;
      try {
        if (!existsSync(resolve(dirname(path), decodeURIComponent(filePart)))) {
          record(repositoryPath(path), `broken local link: ${destination}`);
        }
      } catch {
        record(repositoryPath(path), `invalid link encoding: ${destination}`);
      }
    }

    for (const match of content.matchAll(jsoncPattern)) {
      try {
        const example = parseJsonc(match[1]);
        jsoncExamples += 1;
        if (typeof example === 'object' && example !== null && !Array.isArray(example) && typeof example.$schema === 'string') {
          const schemaName = example.$schema.split('/').at(-1);
          const validate = validators.get(schemaName);
          if (!validate) record(repositoryPath(path), new Error(`unknown example schema: ${example.$schema}`));
          else if (!validate(example)) record(repositoryPath(path), new Error(`example fails ${schemaName}: ${validate.errors?.map(error => `${error.instancePath} ${error.message}`).join('; ')}`));
          else schemaExamples += 1;
        }
      } catch (error) {
        record(repositoryPath(path), `invalid JSONC example: ${error.message}`);
      }
    }
  }

  return markdown.length;
}

const files = filesUnder(root);
verifyJson(files);
const projectStatus = verifyProjectStatus();
verifySpikeStatus(projectStatus);
const workItems = verifyWorkItems(projectStatus);
const proposedSchemaCount = verifyProposedSchemas();
const rfcCount = verifyBaseline();
const markdownCount = verifyMarkdown(files, formalSchemaValidators());

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`verified ${markdownCount} Markdown files, ${jsoncExamples} JSONC examples (${schemaExamples} against formal schemas), ${proposedSchemaCount} proposed schemas, project/spike status, ${workItems.count} work items (actionable: ${workItems.actionable}), and ${rfcCount} RFC baseline entries`);
}
