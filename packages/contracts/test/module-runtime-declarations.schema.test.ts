import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, test } from 'vitest';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const schemaDirectory = resolve(testDirectory, '../schemas');
const readSchema = (name: string) => JSON.parse(readFileSync(join(schemaDirectory, name), 'utf8'));

const ajv = new Ajv2020({ strict: true });
ajv.addSchema(readSchema('shared.schema.json'));
const validateModule = ajv.compile(readSchema('module.schema.json'));
const validateDeclarations = ajv.compile(readSchema('module-runtime-declarations-v1.schema.json'));

const validDeclarations = {
  schemaVersion: '1',
  serviceProviders: [{
    serviceId: 'blankspace.documents',
    contractVersion: '1.0.0',
    providerId: 'documents.local',
    entry: 'server',
    capabilities: ['document.read'],
  }],
  eventHandlers: [{
    eventId: 'blankspace.workspace.updated',
    versionRange: '^1.0',
    handlerId: 'documents.on-workspace-updated',
    entry: 'server',
  }],
};

describe('Module runtime declarations V1 schema', () => {
  test('accepts strict static providers and handlers', () => {
    expect(validateDeclarations(validDeclarations), JSON.stringify(validateDeclarations.errors)).toBe(true);
  });

  test('accepts a content-addressed descriptor reference', () => {
    const module = {
      schemaVersion: '1', id: 'documents', entries: { server: './backend/index.ts' },
      declarations: { path: './runtime-declarations.jsonc', sha256: 'a'.repeat(64) },
    };
    expect(validateModule(module), JSON.stringify(validateModule.errors)).toBe(true);
  });

  test.each([
    ['an empty document', { schemaVersion: '1' }],
    ['unknown fields', { ...validDeclarations, discoveredAt: 'runtime' }],
    ['shared runtime entries', { ...validDeclarations, serviceProviders: [{ ...validDeclarations.serviceProviders[0], entry: 'shared' }] }],
    ['loose contract versions', { ...validDeclarations, serviceProviders: [{ ...validDeclarations.serviceProviders[0], contractVersion: '^1' }] }],
    ['unsupported event ranges', { ...validDeclarations, eventHandlers: [{ ...validDeclarations.eventHandlers[0], versionRange: '~1' }] }],
    ['malformed identifiers', { ...validDeclarations, serviceProviders: [{ ...validDeclarations.serviceProviders[0], serviceId: 'Blankspace.Documents' }] }],
    ['duplicate capabilities', { ...validDeclarations, serviceProviders: [{ ...validDeclarations.serviceProviders[0], capabilities: ['read', 'read'] }] }],
    ['duplicate provider records', { ...validDeclarations, serviceProviders: [validDeclarations.serviceProviders[0], validDeclarations.serviceProviders[0]] }],
  ])('rejects %s', (_label, candidate) => {
    expect(validateDeclarations(candidate)).toBe(false);
  });

  test.each([
    ['an escaping path', { path: './../runtime.jsonc', sha256: 'a'.repeat(64) }],
    ['an uppercase digest', { path: './runtime.jsonc', sha256: 'A'.repeat(64) }],
    ['an unknown reference field', { path: './runtime.jsonc', sha256: 'a'.repeat(64), optional: true }],
  ])('rejects descriptor declarations reference with %s', (_label, declarations) => {
    expect(validateModule({ schemaVersion: '1', id: 'documents', entries: { server: './index.ts' }, declarations })).toBe(false);
  });
});
