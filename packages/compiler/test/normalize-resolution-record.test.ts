import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, test } from 'vitest';

import {
  ResolutionRecordError,
  normalizeResolutionRecord,
  type ResolutionRecordInput,
} from '../src/index.js';

function packageRecord(): ResolutionRecordInput {
  return {
    schemaVersion: '1',
    importer: 'product/modules/notes/frontend/index.ts',
    specifier: '@blankspace/editor/notes',
    mode: 'web-dev',
    target: 'web',
    packageIdentity: '@blankspace/editor',
    exportSubpath: './notes',
    logicalPath: 'packages/editor/src/notes.ts',
    format: 'esm',
    conditions: ['default', 'browser', 'import', 'development'],
    external: false,
  };
}

function recordValidator() {
  const testDirectory = dirname(fileURLToPath(import.meta.url));
  const schemaDirectory = resolve(testDirectory, '../../contracts/schemas');
  const ajv = new Ajv2020({ strict: true });
  ajv.addSchema(JSON.parse(readFileSync(join(schemaDirectory, 'shared.schema.json'), 'utf8')));
  return ajv.compile(JSON.parse(
    readFileSync(join(schemaDirectory, 'resolution-record-v1.schema.json'), 'utf8'),
  ));
}

describe('normalizeResolutionRecord', () => {
  test('normalizes a web package export without mutating condition input', () => {
    const input = packageRecord();
    const originalConditions = [...input.conditions];
    const record = normalizeResolutionRecord(input);

    expect(record.conditions).toEqual(['browser', 'development', 'import', 'default']);
    expect(input.conditions).toEqual(originalConditions);
    expect(record.packageIdentity).toBe('@blankspace/editor');
    expect(record.exportSubpath).toBe('./notes');
  });

  test('produces a record accepted by the canonical schema', () => {
    const validate = recordValidator();
    const record = normalizeResolutionRecord(packageRecord());

    expect(validate(record), JSON.stringify(validate.errors)).toBe(true);
  });

  test('normalizes Node built-in external, JSON and shared test records', () => {
    expect(normalizeResolutionRecord({
      schemaVersion: '1',
      importer: 'packages/server/src/index.ts',
      specifier: 'node:fs',
      mode: 'server',
      target: 'server',
      format: 'external',
      conditions: ['default', 'node', 'import'],
      external: true,
    })).toMatchObject({ conditions: ['node', 'import', 'default'], external: true });

    expect(normalizeResolutionRecord({
      schemaVersion: '1',
      importer: 'packages/shared/src/config.ts',
      specifier: './defaults.json',
      mode: 'type',
      target: 'shared',
      logicalPath: 'packages/shared/src/defaults.json',
      format: 'json',
      conditions: ['default', 'types', 'import'],
      external: false,
    })).toMatchObject({ format: 'json', conditions: ['types', 'import', 'default'] });

    expect(normalizeResolutionRecord({
      schemaVersion: '1',
      importer: 'packages/shared/test/value.test.ts',
      specifier: '../src/value.js',
      mode: 'test',
      target: 'shared',
      logicalPath: 'packages/shared/src/value.ts',
      format: 'esm',
      conditions: ['import', 'default', 'test'],
      external: false,
    })).toMatchObject({ target: 'shared', conditions: ['test', 'import', 'default'] });
  });

  test('produces byte-identical output for different condition order', () => {
    const left = packageRecord();
    const right = packageRecord();
    right.conditions = ['import', 'development', 'default', 'browser'];

    expect(JSON.stringify(normalizeResolutionRecord(right)))
      .toBe(JSON.stringify(normalizeResolutionRecord(left)));
  });

  test.each([
    ['/Users/cary/index.ts', 'logicalPath'],
    ['C:\\repo\\index.ts', 'logicalPath'],
    ['packages\\editor\\index.ts', 'logicalPath'],
    ['../secret.ts', 'logicalPath'],
    ['packages/editor/../secret.ts', 'logicalPath'],
    ['file:///tmp/editor/index.ts', 'logicalPath'],
    ['.pnpm/editor/index.ts', 'logicalPath'],
    ['node_modules/editor/index.ts', 'logicalPath'],
    ['packages/editor//index.ts', 'logicalPath'],
  ])('rejects unsafe logical path %s', (logicalPath, path) => {
    expectDiagnostics({ ...packageRecord(), logicalPath }, [
      ['E_RESOLUTION_LOGICAL_PATH', path],
    ]);
  });

  test.each([
    [['browser', 'import', 'default']],
    [['browser', 'development', 'worker', 'import', 'default']],
    [['browser', 'development', 'import', 'import']],
  ])('rejects missing, extra or duplicate conditions', conditions => {
    expectDiagnostics({ ...packageRecord(), conditions }, [
      ['E_RESOLUTION_CONDITIONS', 'conditions'],
    ]);
  });

  test('rejects an invalid mode and target pair', () => {
    expectDiagnostics({ ...packageRecord(), target: 'server' }, [
      ['E_RESOLUTION_MODE_TARGET', 'mode'],
    ]);
  });

  test('rejects invalid package export shapes', () => {
    const missingSubpath = packageRecord();
    delete missingSubpath.exportSubpath;
    expectDiagnostics(missingSubpath, [['E_RESOLUTION_PACKAGE_SHAPE', 'exportSubpath']]);

    const missingIdentity = packageRecord();
    delete missingIdentity.packageIdentity;
    expectDiagnostics(missingIdentity, [['E_RESOLUTION_PACKAGE_SHAPE', 'packageIdentity']]);

    expectDiagnostics({ ...packageRecord(), exportSubpath: './../internal' }, [
      ['E_RESOLUTION_PACKAGE_SHAPE', 'exportSubpath'],
    ]);
  });

  test('rejects external and internal shape conflicts', () => {
    expectDiagnostics({ ...packageRecord(), format: 'external' }, [
      ['E_RESOLUTION_EXTERNAL_SHAPE', 'external'],
    ]);
    expectDiagnostics({ ...packageRecord(), external: true }, [
      ['E_RESOLUTION_EXTERNAL_SHAPE', 'format'],
      ['E_RESOLUTION_EXTERNAL_SHAPE', 'logicalPath'],
    ]);

    const missingPath = packageRecord();
    delete missingPath.logicalPath;
    expectDiagnostics(missingPath, [['E_RESOLUTION_LOGICAL_PATH', 'logicalPath']]);
  });

  test('deduplicates and sorts complete diagnostics by code and path', () => {
    const candidate = packageRecord();
    candidate.importer = '/tmp/importer.ts';
    candidate.logicalPath = 'node_modules/.pnpm/editor/index.ts';
    candidate.external = true;
    candidate.exportSubpath = './../internal';
    candidate.conditions = ['browser', 'import', 'import'];

    expectDiagnostics(candidate, [
      ['E_RESOLUTION_CONDITIONS', 'conditions'],
      ['E_RESOLUTION_EXTERNAL_SHAPE', 'format'],
      ['E_RESOLUTION_EXTERNAL_SHAPE', 'logicalPath'],
      ['E_RESOLUTION_LOGICAL_PATH', 'importer'],
      ['E_RESOLUTION_LOGICAL_PATH', 'logicalPath'],
      ['E_RESOLUTION_PACKAGE_SHAPE', 'exportSubpath'],
    ]);
  });
});

function expectDiagnostics(
  input: ResolutionRecordInput,
  expected: Array<[string, string]>,
): void {
  try {
    normalizeResolutionRecord(input);
    throw new Error('Expected resolution normalization to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(ResolutionRecordError);
    expect((error as ResolutionRecordError).diagnostics.map(({ code, path }) => [code, path]))
      .toEqual(expected);
  }
}
