import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { hashCanonical, parseJsonc } from './jsonc.mjs';

test('hash is independent from the checkout absolute path', async () => {
  const first = await mkdtemp(path.join(tmpdir(), 'blankspace-s1-a-'));
  const second = await mkdtemp(path.join(tmpdir(), 'blankspace-s1-b-'));
  const source = '{"schemaVersion":"1","product":"./product","targets":["web"]}';

  try {
    const firstFile = path.join(first, 'blankspace.config.jsonc');
    const secondFile = path.join(second, 'blankspace.config.jsonc');
    await Promise.all([writeFile(firstFile, source), writeFile(secondFile, source)]);

    const firstValue = parseJsonc(source);
    const secondValue = parseJsonc(source);
    assert.equal(hashCanonical(firstValue), hashCanonical(secondValue));
  } finally {
    await Promise.all([rm(first, { recursive: true }), rm(second, { recursive: true })]);
  }
});
