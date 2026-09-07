import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import Ajv2020 from 'ajv/dist/2020.js';

import { runSignalCorpus } from './signal-runner.mjs';

const transcriptPromise = runSignalCorpus();

test('S6 records the approved platform signal boundary', async () => {
  const transcript = await transcriptPromise;
  if (process.platform === 'win32') {
    assert.equal(transcript.support, 'unsupported-by-node');
    assert.deepEqual(transcript.signals, []);
    return;
  }
  assert.equal(transcript.support, 'posix');
  assert.deepEqual(transcript.signals.map(item => item.signal), ['SIGTERM', 'SIGINT']);
  for (const item of transcript.signals) {
    assert.equal(item.handlerInvocationCount, 2);
    assert.equal(item.stopInvocationCount, 2);
    assert.equal(item.serverCloseCount, 1);
    assert.deepEqual(item.entryStopCounts, { A: 1, B: 1 });
    assert.equal(item.exitClassification, 'zero');
  }
});

test('S6 signal transcript conforms to its frozen schema', async () => {
  const [transcript, schema] = await Promise.all([
    transcriptPromise,
    readFile(new URL('./signal-transcript.schema.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  const validate = new Ajv2020({ strict: true }).compile(schema);
  assert.equal(validate(transcript), true, JSON.stringify(validate.errors));
});
