import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { runProductionConfigCorpus } from './run-production.mjs';

test('production S1 corpus matches the cross-platform canonical transcript', async () => {
  const expected = JSON.parse(await readFile(join(import.meta.dirname, 'transcripts/canonical.json'), 'utf8'));
  assert.deepEqual(runProductionConfigCorpus(), expected);
});
