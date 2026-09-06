import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, test } from 'vitest';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const schemaDirectory = resolve(testDirectory, '../schemas');
const registrySchema = JSON.parse(readFileSync(join(schemaDirectory, 'executable-registry-v1.schema.json'), 'utf8'));
const sharedSchema = JSON.parse(readFileSync(join(schemaDirectory, 'shared.schema.json'), 'utf8'));
const validRegistry = JSON.parse(readFileSync(join(testDirectory, 'fixtures/executable-registry.valid.json'), 'utf8'));

const ajv = new Ajv2020({ strict: true });
ajv.addSchema(sharedSchema);
const validate = ajv.compile(registrySchema);

describe('ExecutableRegistryV1 schema', () => {
  test('accepts the minimal target-specific registry', () => {
    expect(validate(validRegistry), JSON.stringify(validate.errors)).toBe(true);
  });

  test('accepts explicit Service bindings and Event handlers', () => {
    const candidate = {
      ...validRegistry,
      bindings: [
        { serviceId: 'service.clock', providerId: 'product', entryId: 'product.web' },
      ],
      handlers: [
        { eventId: 'event.tick', handlerId: 'handler.tick', entryId: 'product.web' },
      ],
    };

    expect(validate(candidate), JSON.stringify(validate.errors)).toBe(true);
  });

  test.each([
    ['unknown fields', { ...validRegistry, generatedAt: '2026-09-06T00:00:00Z' }],
    ['absolute module paths', { ...validRegistry, entries: [{ ...validRegistry.entries[0], module: '/tmp/index.js' }] }],
    ['backslash module paths', { ...validRegistry, entries: [{ ...validRegistry.entries[0], module: '.\\product\\index.js' }] }],
    ['invalid target values', { ...validRegistry, target: 'desktop' }],
    ['non-canonical assembly digests', { ...validRegistry, assemblyId: 'SHA256:abc' }],
  ])('rejects %s', (_label, candidate) => {
    expect(validate(candidate)).toBe(false);
  });

  test('accepts declaration order for the compiler to canonicalize', () => {
    const candidate = {
      ...validRegistry,
      entries: [
        { entryId: 'product.zeta.web', ownerId: 'zeta', target: 'web', module: './zeta.js', exportName: 'default' },
        { entryId: 'product.alpha.web', ownerId: 'alpha', target: 'web', module: './alpha.js', exportName: 'default' },
      ],
    };

    expect(validate(candidate), JSON.stringify(validate.errors)).toBe(true);
  });
});
