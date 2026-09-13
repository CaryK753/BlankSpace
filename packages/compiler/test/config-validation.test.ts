import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, test } from 'vitest';

import {
  ConfigValidationError, JsoncSyntaxError, canonicalize, hashCanonical, parseJsonc, validateJsonc,
} from '../src/index.js';

const schemaDirectory = join(import.meta.dirname, '../../contracts/schemas');

function productConfigValidator() {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  ajv.addSchema(JSON.parse(readFileSync(join(schemaDirectory, 'shared.schema.json'), 'utf8')));
  return ajv.compile(JSON.parse(readFileSync(join(schemaDirectory, 'product-config.schema.json'), 'utf8')));
}

describe('production JSONC validation boundary', () => {
  test('accepts the frozen dialect and preserves canonical identity', () => {
    const left = parseJsonc(`{
      // selected product
      "targets": ["web",],
      "product": "./product",
      "schemaVersion": "1",
    }`);
    const right = parseJsonc('{"schemaVersion":"1","product":"./product","targets":["web"]}');
    expect(canonicalize(left)).toBe(canonicalize(right));
    expect(hashCanonical(left)).toBe(hashCanonical(right));
  });

  test('keeps special object keys as data without mutating the object prototype', () => {
    const value = parseJsonc('{"__proto__":{"polluted":true},"constructor":"data"}');
    expect(Object.getPrototypeOf(value)).toBeNull();
    expect(Object.hasOwn(value as object, '__proto__')).toBe(true);
    expect(canonicalize(value)).toBe('{"__proto__":{"polluted":true},"constructor":"data"}');
  });

  test('rejects duplicate keys with stable source coordinates', () => {
    try {
      parseJsonc('{\n  "id": "a",\n  "id": "b"\n}');
      expect.unreachable('expected JSONC parsing to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(JsoncSyntaxError);
      expect((error as JsoncSyntaxError).diagnostics).toEqual([{
        code: 'E_CONFIG_JSONC_DUPLICATE_KEY', path: '$.id', message: 'Duplicate key "id"',
        offset: 17, line: 3, column: 3,
      }]);
    }
  });

  test.each([
    ['executable expression', '{"value": process.env.SECRET}'],
    ['unquoted key', '{key: "value"}'],
    ['trailing content', '{} {}'],
    ['non-JSON whitespace', '{\u00a0"id":"projects"}'],
    ['non-finite number', '{"value":1e999}'],
  ])('rejects %s with a stable syntax diagnostic', (_name, source) => {
    try {
      parseJsonc(source);
      expect.unreachable('expected JSONC parsing to fail');
    } catch (error) {
      const diagnostic = (error as JsoncSyntaxError).diagnostics[0];
      expect(diagnostic?.code).toBe('E_CONFIG_JSONC_SYNTAX');
      expect(diagnostic?.path).toMatch(/^\$/);
      expect(diagnostic?.line).toBeGreaterThan(0);
      expect(diagnostic?.column).toBeGreaterThan(0);
    }
  });

  test('maps Ajv failures to stable instance paths', () => {
    try {
      validateJsonc('{"schemaVersion":"1","product":"../escape","targets":["desktop"]}', productConfigValidator());
      expect.unreachable('expected schema validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect((error as ConfigValidationError).diagnostics.map(({ code, path, keyword }) =>
        [code, path, keyword])).toEqual([
        ['E_CONFIG_SCHEMA', '/product', 'pattern'],
        ['E_CONFIG_SCHEMA', '/targets/0', 'enum'],
      ]);
    }
  });
});
