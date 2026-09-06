import { createHash } from 'node:crypto';

const whitespace = /[\u0009\u000a\u000d\u0020]/;

export class JsoncSyntaxError extends SyntaxError {
  constructor(message, offset) {
    super(`${message} at offset ${offset}`);
    this.name = 'JsoncSyntaxError';
    this.offset = offset;
  }
}

export function parseJsonc(source) {
  let offset = 0;

  function fail(message) {
    throw new JsoncSyntaxError(message, offset);
  }

  function skipTrivia() {
    while (offset < source.length) {
      if (whitespace.test(source[offset])) {
        offset += 1;
        continue;
      }
      if (source.startsWith('//', offset)) {
        offset += 2;
        while (offset < source.length && !'\r\n'.includes(source[offset])) offset += 1;
        continue;
      }
      if (source.startsWith('/*', offset)) {
        const end = source.indexOf('*/', offset + 2);
        if (end < 0) fail('Unterminated block comment');
        offset = end + 2;
        continue;
      }
      break;
    }
  }

  function parseString() {
    const start = offset;
    offset += 1;
    let escaped = false;
    while (offset < source.length) {
      const character = source[offset];
      if (!escaped && character === '"') {
        offset += 1;
        try {
          return JSON.parse(source.slice(start, offset));
        } catch {
          fail('Invalid string');
        }
      }
      if (!escaped && (character === '\n' || character === '\r')) fail('Unterminated string');
      escaped = !escaped && character === '\\';
      if (character !== '\\') escaped = false;
      offset += 1;
    }
    fail('Unterminated string');
  }

  function parseNumber() {
    const rest = source.slice(offset);
    const match = rest.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (!match) fail('Invalid number');
    offset += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) fail('Number must be finite');
    return value;
  }

  function parseKeyword(keyword, value) {
    if (!source.startsWith(keyword, offset)) fail(`Expected ${keyword}`);
    offset += keyword.length;
    return value;
  }

  function parseArray() {
    const values = [];
    offset += 1;
    skipTrivia();
    if (source[offset] === ']') {
      offset += 1;
      return values;
    }
    while (offset < source.length) {
      values.push(parseValue());
      skipTrivia();
      if (source[offset] === ']') {
        offset += 1;
        return values;
      }
      if (source[offset] !== ',') fail('Expected comma or closing bracket');
      offset += 1;
      skipTrivia();
      if (source[offset] === ']') {
        offset += 1;
        return values;
      }
    }
    fail('Unterminated array');
  }

  function parseObject() {
    const result = Object.create(null);
    const keys = new Set();
    offset += 1;
    skipTrivia();
    if (source[offset] === '}') {
      offset += 1;
      return result;
    }
    while (offset < source.length) {
      if (source[offset] !== '"') fail('Object keys must be quoted strings');
      const key = parseString();
      if (keys.has(key)) fail(`Duplicate key ${JSON.stringify(key)}`);
      keys.add(key);
      skipTrivia();
      if (source[offset] !== ':') fail('Expected colon');
      offset += 1;
      result[key] = parseValue();
      skipTrivia();
      if (source[offset] === '}') {
        offset += 1;
        return result;
      }
      if (source[offset] !== ',') fail('Expected comma or closing brace');
      offset += 1;
      skipTrivia();
      if (source[offset] === '}') {
        offset += 1;
        return result;
      }
    }
    fail('Unterminated object');
  }

  function parseValue() {
    skipTrivia();
    const character = source[offset];
    if (character === '{') return parseObject();
    if (character === '[') return parseArray();
    if (character === '"') return parseString();
    if (character === '-' || (character >= '0' && character <= '9')) return parseNumber();
    if (character === 't') return parseKeyword('true', true);
    if (character === 'f') return parseKeyword('false', false);
    if (character === 'n') return parseKeyword('null', null);
    fail('Expected a JSON value');
  }

  const result = parseValue();
  skipTrivia();
  if (offset !== source.length) fail('Unexpected trailing content');
  return result;
}

export function canonicalize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON rejects non-finite numbers');
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  throw new TypeError(`Canonical JSON rejects ${typeof value}`);
}

export function hashCanonical(value) {
  return createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');
}
