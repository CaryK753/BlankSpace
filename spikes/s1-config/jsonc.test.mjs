import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalize, hashCanonical, JsoncSyntaxError, parseJsonc } from './jsonc.mjs';

test('accepts comments and trailing commas', () => {
  const value = parseJsonc(`{
    // product entry
    "targets": ["web", "server",],
    "product": "./product",
    /* stable schema */
    "schemaVersion": "1",
  }`);

  assert.deepEqual({ ...value }, {
    targets: ['web', 'server'],
    product: './product',
    schemaVersion: '1',
  });
});

test('canonical output ignores key order, comments, and formatting', () => {
  const left = parseJsonc('{"b": 2, "a": [true, null]}');
  const right = parseJsonc('{ /* note */ "a": [true,null,], "b": 2, }');

  assert.equal(canonicalize(left), '{"a":[true,null],"b":2}');
  assert.equal(canonicalize(left), canonicalize(right));
  assert.equal(hashCanonical(left), hashCanonical(right));
});

test('rejects duplicate keys', () => {
  assert.throws(() => parseJsonc('{"id":"a","id":"b"}'), JsoncSyntaxError);
});

test('rejects executable and non-JSON expressions', () => {
  for (const source of [
    '{"value": process.env.SECRET}',
    '{"value": Infinity}',
    '{"value": undefined}',
    '{key: "value"}',
  ]) {
    assert.throws(() => parseJsonc(source), JsoncSyntaxError);
  }
});

test('rejects malformed comments and trailing content', () => {
  assert.throws(() => parseJsonc('{/* missing */'), JsoncSyntaxError);
  assert.throws(() => parseJsonc('{} {}'), JsoncSyntaxError);
});

test('rejects non-JSON Unicode whitespace', () => {
  assert.throws(() => parseJsonc('{\u00a0"id":"projects"}'), JsoncSyntaxError);
});

test('preserves array order and normalizes negative zero', () => {
  assert.equal(canonicalize(parseJsonc('{"values":[2,1,-0]}')), '{"values":[2,1,0]}');
});
