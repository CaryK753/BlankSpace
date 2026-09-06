export type PackageExportResolution =
  | { matched: false }
  | { matched: true; target: string | null | undefined };

export class PackageExportsShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PackageExportsShapeError';
  }
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveConditionalTarget(
  value: unknown,
  conditions: readonly string[],
): string | null | undefined {
  if (typeof value === 'string' || value === null) return value;
  if (!isObject(value)) {
    throw new PackageExportsShapeError('Export targets must be strings, null, or condition objects.');
  }

  const keys = Object.keys(value);
  if (keys.some(key => key.startsWith('.'))) {
    throw new PackageExportsShapeError('Condition objects cannot contain package subpath keys.');
  }

  for (const [condition, target] of Object.entries(value)) {
    if (condition !== 'default' && !conditions.includes(condition)) continue;
    const resolved = resolveConditionalTarget(target, conditions);
    if (resolved !== undefined) return resolved;
  }
  return undefined;
}

interface PatternMatch {
  key: string;
  replacement: string;
  value: unknown;
}

function matchingPatterns(exports: JsonObject, subpath: string): PatternMatch[] {
  return Object.entries(exports).flatMap(([key, value]) => {
    const star = key.indexOf('*');
    if (star < 0 || star !== key.lastIndexOf('*')) return [];
    const prefix = key.slice(0, star);
    const suffix = key.slice(star + 1);
    if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) return [];
    if (subpath.length < prefix.length + suffix.length) return [];
    return [{ key, value, replacement: subpath.slice(prefix.length, subpath.length - suffix.length) }];
  }).sort((left, right) => {
    const leftPrefix = left.key.indexOf('*');
    const rightPrefix = right.key.indexOf('*');
    return rightPrefix - leftPrefix || right.key.length - left.key.length;
  });
}

function substitutePattern(target: string | null | undefined, replacement: string): string | null | undefined {
  return typeof target === 'string' ? target.replaceAll('*', replacement) : target;
}

export function resolvePackageExport(
  exportsField: unknown,
  subpath: string,
  conditions: readonly string[],
): PackageExportResolution {
  if (typeof exportsField === 'string' || exportsField === null) {
    if (subpath !== '.') return { matched: false };
    return { matched: true, target: exportsField };
  }
  if (!isObject(exportsField)) {
    throw new PackageExportsShapeError('Package exports must be a string, null, or object.');
  }

  const keys = Object.keys(exportsField);
  const hasSubpaths = keys.some(key => key.startsWith('.'));
  if (hasSubpaths && keys.some(key => !key.startsWith('.'))) {
    throw new PackageExportsShapeError('Package exports cannot mix subpath and condition keys.');
  }
  if (!hasSubpaths) {
    if (subpath !== '.') return { matched: false };
    return { matched: true, target: resolveConditionalTarget(exportsField, conditions) };
  }

  if (Object.hasOwn(exportsField, subpath)) {
    return {
      matched: true,
      target: resolveConditionalTarget(exportsField[subpath], conditions),
    };
  }

  const pattern = matchingPatterns(exportsField, subpath)[0];
  if (pattern === undefined) return { matched: false };
  return {
    matched: true,
    target: substitutePattern(resolveConditionalTarget(pattern.value, conditions), pattern.replacement),
  };
}
