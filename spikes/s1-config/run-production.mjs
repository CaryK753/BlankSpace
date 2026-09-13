import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';

import {
  ConfigValidationError,
  JsoncSyntaxError,
  canonicalize,
  hashCanonical,
  parseJsonc,
  validateJsonc,
} from '../../packages/compiler/dist/index.js';

const directory = dirname(fileURLToPath(import.meta.url));
const schemaDirectory = join(directory, '../../packages/contracts/schemas');

function validator() {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  ajv.addSchema(JSON.parse(readFileSync(join(schemaDirectory, 'shared.schema.json'), 'utf8')));
  return ajv.compile(JSON.parse(readFileSync(join(schemaDirectory, 'product-config.schema.json'), 'utf8')));
}

function diagnosticsFor(source, validate) {
  try {
    validate ? validateJsonc(source, validate) : parseJsonc(source);
    return [];
  } catch (error) {
    if (error instanceof JsoncSyntaxError || error instanceof ConfigValidationError) {
      return error.diagnostics.map(({ code, path, offset, line, column, keyword }) => ({
        code, path, ...(offset === undefined ? {} : { offset }),
        ...(line === undefined ? {} : { line }), ...(column === undefined ? {} : { column }),
        ...(keyword === undefined ? {} : { keyword }),
      }));
    }
    throw error;
  }
}

export function runProductionConfigCorpus() {
  const accepted = parseJsonc(`{
    // canonical input
    "targets": ["web", "server",],
    "product": "./product",
    "schemaVersion": "1",
  }`);
  const validate = validator();
  return {
    schemaVersion: '1',
    tools: { node: '24', jsoncParser: '3.3.1', ajv: '8.20.0' },
    accepted: {
      canonical: canonicalize(accepted),
      hash: hashCanonical(accepted),
    },
    rejected: {
      duplicate: diagnosticsFor('{\n  "id": "a",\n  "id": "b"\n}'),
      expression: diagnosticsFor('{"value": process.env.SECRET}'),
      nonFinite: diagnosticsFor('{"value":1e999}'),
      schema: diagnosticsFor(
        '{"schemaVersion":"1","product":"../escape","targets":["desktop"]}', validate,
      ),
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(runProductionConfigCorpus(), null, 2)}\n`);
}
