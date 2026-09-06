import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, test } from 'vitest';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const schemaDirectory = resolve(testDirectory, '../schemas');
const validRecord = JSON.parse(
  readFileSync(join(testDirectory, 'fixtures/resolution-record.valid.json'), 'utf8'),
) as Record<string, unknown>;
const ajv = new Ajv2020({ strict: true });
ajv.addSchema(JSON.parse(readFileSync(join(schemaDirectory, 'shared.schema.json'), 'utf8')));
const validate = ajv.compile(
  JSON.parse(readFileSync(join(schemaDirectory, 'resolution-record-v1.schema.json'), 'utf8')),
);

describe('ResolutionRecordV1 schema', () => {
  test('accepts package, external, JSON and shared-test records', () => {
    const candidates = [
      validRecord,
      {
        schemaVersion: '1',
        importer: 'packages/server/src/index.ts',
        specifier: 'node:fs',
        mode: 'server',
        target: 'server',
        format: 'external',
        conditions: ['node', 'import', 'default'],
        external: true,
      },
      {
        schemaVersion: '1',
        importer: 'packages/shared/src/config.ts',
        specifier: './defaults.json',
        mode: 'type',
        target: 'shared',
        logicalPath: 'packages/shared/src/defaults.json',
        format: 'json',
        conditions: ['types', 'import', 'default'],
        external: false,
      },
      {
        schemaVersion: '1',
        importer: 'packages/shared/test/value.test.ts',
        specifier: '../src/value.js',
        mode: 'test',
        target: 'shared',
        logicalPath: 'packages/shared/src/value.ts',
        format: 'esm',
        conditions: ['test', 'import', 'default'],
        external: false,
      },
    ];

    for (const candidate of candidates) {
      expect(validate(candidate), JSON.stringify(validate.errors)).toBe(true);
    }
  });

  test.each([
    ['unknown fields', { ...validRecord, realpath: '/tmp/package/index.js' }],
    ['absolute paths', { ...validRecord, logicalPath: '/Users/cary/index.ts' }],
    ['drive paths', { ...validRecord, logicalPath: 'C:\\repo\\index.ts' }],
    ['backslashes', { ...validRecord, importer: 'packages\\editor\\index.ts' }],
    ['parent traversal', { ...validRecord, logicalPath: 'packages/editor/../secret.ts' }],
    ['URL paths', { ...validRecord, logicalPath: 'file:///tmp/editor/index.ts' }],
    ['pnpm store paths', { ...validRecord, logicalPath: '.pnpm/editor/index.ts' }],
    ['node_modules paths', { ...validRecord, logicalPath: 'node_modules/editor/index.ts' }],
    ['condition order', { ...validRecord, conditions: ['default', 'import', 'development', 'browser'] }],
    ['duplicate conditions', { ...validRecord, conditions: ['browser', 'development', 'import', 'import'] }],
    ['invalid mode target', { ...validRecord, target: 'server' }],
    ['unpaired package identity', omit(validRecord, 'exportSubpath')],
    ['unpaired export subpath', omit(validRecord, 'packageIdentity')],
    ['external format on internal record', { ...validRecord, format: 'external' }],
    ['logical path on external record', { ...validRecord, external: true, format: 'external' }],
    ['missing internal logical path', omit(validRecord, 'logicalPath')],
  ])('rejects %s', (_label, candidate) => {
    expect(validate(candidate)).toBe(false);
  });
});

function omit(record: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([candidate]) => candidate !== key));
}
