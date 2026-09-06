import { lstatSync, readdirSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export type ExactPathState = 'file' | 'missing' | 'case-mismatch' | 'symlink';

export function absoluteFromLogical(root: string, logicalPath: string): string {
  return resolve(root, ...logicalPath.split('/'));
}

export function isWithin(root: string, candidate: string): boolean {
  const relation = relative(root, candidate);
  return relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation));
}

export function inspectExactFile(root: string, logicalPath: string): ExactPathState {
  let current = root;
  for (const segment of logicalPath.split('/')) {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return 'missing';
    }
    if (!entries.includes(segment)) {
      return entries.some(entry => entry.toLocaleLowerCase() === segment.toLocaleLowerCase())
        ? 'case-mismatch'
        : 'missing';
    }
    current = resolve(current, segment);
    try {
      if (lstatSync(current).isSymbolicLink()) return 'symlink';
    } catch {
      return 'missing';
    }
  }
  try {
    return lstatSync(current).isFile() ? 'file' : 'missing';
  } catch {
    return 'missing';
  }
}
