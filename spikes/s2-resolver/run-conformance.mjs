import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { runConformanceMatrix, stableJson } from './conformance-matrix.mjs';

const transcript = await runConformanceMatrix();
const output = stableJson(transcript);
const writeIndex = process.argv.indexOf('--write');

if (writeIndex >= 0) {
  const destination = process.argv[writeIndex + 1];
  if (destination === undefined) throw new Error('--write requires a destination path.');
  await writeFile(resolve(destination), output);
} else {
  process.stdout.write(output);
}
