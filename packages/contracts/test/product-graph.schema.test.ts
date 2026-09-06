import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, test } from 'vitest';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const schemaDirectory = resolve(testDirectory, '../schemas');
const graphSchema = JSON.parse(readFileSync(join(schemaDirectory, 'product-graph-v1.schema.json'), 'utf8'));
const sharedSchema = JSON.parse(readFileSync(join(schemaDirectory, 'shared.schema.json'), 'utf8'));
const validGraph = JSON.parse(readFileSync(join(testDirectory, 'fixtures/product-graph.valid.json'), 'utf8'));

const ajv = new Ajv2020({ strict: true });
ajv.addSchema(sharedSchema);
const validate = ajv.compile(graphSchema);

describe('ProductGraphV1 schema', () => {
  test('accepts the minimal target-specific graph', () => {
    expect(validate(validGraph)).toBe(true);
  });

  test.each([
    ['unknown fields', { ...validGraph, generatedAt: '2026-09-06T00:00:00Z' }],
    ['absolute module paths', { ...validGraph, entries: [{ ...validGraph.entries[0], module: '/tmp/index.js' }] }],
    ['invalid target values', { ...validGraph, target: 'desktop' }],
    ['non-canonical digests', { ...validGraph, inputHash: 'SHA256:abc' }],
  ])('rejects %s', (_label, candidate) => {
    expect(validate(candidate)).toBe(false);
  });

  test('preserves the declared array order for the compiler to validate', () => {
    const reversed = {
      ...validGraph,
      modules: [
        { id: 'zeta', descriptor: './product/modules/zeta/module.jsonc' },
        { id: 'alpha', descriptor: './product/modules/alpha/module.jsonc' },
      ],
    };

    expect(validate(reversed)).toBe(true);
  });
});
