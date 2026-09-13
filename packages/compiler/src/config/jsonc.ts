import { createHash } from 'node:crypto';

import type { ValidateFunction } from 'ajv';
import {
  getLocation, getNodePath, parseTree, printParseErrorCode,
  type Node, type ParseError,
} from 'jsonc-parser';

export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };
export type ConfigDiagnosticCode = 'E_CONFIG_JSONC_DUPLICATE_KEY' | 'E_CONFIG_JSONC_SYNTAX' | 'E_CONFIG_SCHEMA';

export interface ConfigDiagnostic {
  code: ConfigDiagnosticCode;
  path: string;
  message: string;
  offset?: number;
  line?: number;
  column?: number;
  keyword?: string;
}

export class JsoncSyntaxError extends SyntaxError {
  readonly offset: number;
  readonly diagnostics: ConfigDiagnostic[];

  constructor(diagnostics: ConfigDiagnostic[]) {
    const first = diagnostics[0] ?? syntaxDiagnostic('', 0, 'Invalid JSONC');
    super(`${first.message} at ${first.path} (${first.line}:${first.column})`);
    this.name = 'JsoncSyntaxError';
    this.offset = first.offset ?? 0;
    this.diagnostics = diagnostics;
  }
}

export class ConfigValidationError extends Error {
  readonly diagnostics: ConfigDiagnostic[];

  constructor(diagnostics: ConfigDiagnostic[]) {
    super(diagnostics.map(({ code, path, message }) => `${code} ${path}: ${message}`).join('\n'));
    this.name = 'ConfigValidationError';
    this.diagnostics = diagnostics;
  }
}

function positionAt(source: string, offset: number): { line: number; column: number } {
  const lines = source.slice(0, offset).split(/\r\n|\r|\n/);
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

function formatPath(segments: readonly (string | number)[]): string {
  return segments.reduce<string>((path, segment) => {
    if (typeof segment === 'number') return `${path}[${segment}]`;
    return /^[A-Za-z_$][\w$]*$/.test(segment) ? `${path}.${segment}` : `${path}[${JSON.stringify(segment)}]`;
  }, '$');
}

function syntaxDiagnostic(source: string, offset: number, message: string): ConfigDiagnostic {
  return {
    code: 'E_CONFIG_JSONC_SYNTAX',
    path: formatPath(getLocation(source, offset).path),
    message,
    offset,
    ...positionAt(source, offset),
  };
}

function collectDuplicateKeys(source: string, node: Node, diagnostics: ConfigDiagnostic[]): void {
  if (node.type === 'object') {
    const keys = new Set<string>();
    for (const property of node.children ?? []) {
      const keyNode = property.children?.[0];
      const key = keyNode?.value;
      if (keyNode && typeof key === 'string') {
        if (keys.has(key)) diagnostics.push({
          code: 'E_CONFIG_JSONC_DUPLICATE_KEY',
          path: formatPath([...getNodePath(property), key]),
          message: `Duplicate key ${JSON.stringify(key)}`,
          offset: keyNode.offset,
          ...positionAt(source, keyNode.offset),
        });
        keys.add(key);
      }
    }
  }
  for (const child of node.children ?? []) collectDuplicateKeys(source, child, diagnostics);
}

function collectNonFiniteNumbers(source: string, node: Node, diagnostics: ConfigDiagnostic[]): void {
  if (node.type === 'number' && !Number.isFinite(node.value)) {
    diagnostics.push({
      ...syntaxDiagnostic(source, node.offset, 'NumberMustBeFinite'),
      path: formatPath(getNodePath(node)),
    });
  }
  for (const child of node.children ?? []) collectNonFiniteNumbers(source, child, diagnostics);
}

function stableDiagnostics(diagnostics: ConfigDiagnostic[]): ConfigDiagnostic[] {
  const unique = new Map<string, ConfigDiagnostic>();
  for (const diagnostic of diagnostics) {
    unique.set(`${diagnostic.code}:${diagnostic.path}:${diagnostic.offset ?? -1}:${diagnostic.keyword ?? ''}`, diagnostic);
  }
  return [...unique.values()].sort((left, right) =>
    `${left.code}:${left.path}:${String(left.offset ?? -1).padStart(12, '0')}`
      .localeCompare(`${right.code}:${right.path}:${String(right.offset ?? -1).padStart(12, '0')}`));
}

function nodeToJsonValue(node: Node): JsonValue {
  if (node.type === 'array') return (node.children ?? []).map(nodeToJsonValue);
  if (node.type === 'object') {
    const result = Object.create(null) as JsonObject;
    for (const property of node.children ?? []) {
      const key = property.children?.[0]?.value;
      const value = property.children?.[1];
      if (typeof key === 'string' && value) result[key] = nodeToJsonValue(value);
    }
    return result;
  }
  return node.value as null | boolean | number | string;
}

export function parseJsonc(source: string): JsonValue {
  const parseErrors: ParseError[] = [];
  const root = parseTree(source, parseErrors, { allowTrailingComma: true, disallowComments: false });
  const diagnostics = parseErrors.map(error =>
    syntaxDiagnostic(source, error.offset, printParseErrorCode(error.error)));
  if (root) {
    collectDuplicateKeys(source, root, diagnostics);
    collectNonFiniteNumbers(source, root, diagnostics);
  }
  const stable = stableDiagnostics(diagnostics);
  if (!root || stable.length > 0) throw new JsoncSyntaxError(stable);
  return nodeToJsonValue(root);
}

export function validateJsonc(source: string, validate: ValidateFunction): JsonValue {
  const value = parseJsonc(source);
  if (validate(value)) return value;
  const diagnostics = stableDiagnostics((validate.errors ?? []).map(error => ({
    code: 'E_CONFIG_SCHEMA' as const,
    path: error.instancePath || '$',
    message: error.message ?? 'Schema validation failed',
    keyword: error.keyword,
  })));
  throw new ConfigValidationError(diagnostics);
}

export function canonicalize(value: JsonValue): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON rejects non-finite numbers');
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const entries = Object.keys(value).sort()
    .map(key => `${JSON.stringify(key)}:${canonicalize(value[key] as JsonValue)}`);
  return `{${entries.join(',')}}`;
}

export function hashCanonical(value: JsonValue): string {
  return createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');
}
