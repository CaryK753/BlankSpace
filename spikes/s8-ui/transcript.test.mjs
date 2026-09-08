import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import {createTranscript} from './transcript.mjs';

test('S8 transcript matches its local baseline and frozen schema', async () => {
  const baselineName = `${process.platform}-${process.arch}.json`;
  const [actual, baseline, schema] = await Promise.all([
    createTranscript(),
    readFile(new URL(`./transcripts/${baselineName}`, import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('./transcript.schema.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  const validate = new Ajv2020({strict: true}).compile(schema);
  assert.equal(validate(actual), true, JSON.stringify(validate.errors));
  const stableActual = structuredClone(actual);
  const stableBaseline = structuredClone(baseline);
  if (stableActual.ci) delete stableActual.ci.sourceCommit;
  if (stableBaseline.ci) delete stableBaseline.ci.sourceCommit;
  assert.deepEqual(stableActual, stableBaseline);
  assert.deepEqual(actual.diagnostics, []);
});
