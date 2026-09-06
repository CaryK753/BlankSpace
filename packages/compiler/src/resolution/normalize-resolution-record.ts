import type {
  ResolutionMode,
  ResolutionRecordV1,
  ResolutionTarget,
} from '@blankspace/contracts';

export type ResolutionRecordInput = Omit<ResolutionRecordV1, 'conditions'> & {
  conditions: string[];
};

export type ResolutionDiagnosticCode =
  | 'E_RESOLUTION_MODE_TARGET'
  | 'E_RESOLUTION_CONDITIONS'
  | 'E_RESOLUTION_LOGICAL_PATH'
  | 'E_RESOLUTION_PACKAGE_SHAPE'
  | 'E_RESOLUTION_EXTERNAL_SHAPE';

export interface ResolutionRecordDiagnostic {
  code: ResolutionDiagnosticCode;
  path: string;
  message: string;
}

export class ResolutionRecordError extends Error {
  readonly diagnostics: ResolutionRecordDiagnostic[];

  constructor(diagnostics: ResolutionRecordDiagnostic[]) {
    super(diagnostics.map(({ code, path, message }) => `${code} ${path}: ${message}`).join('\n'));
    this.name = 'ResolutionRecordError';
    this.diagnostics = diagnostics;
  }
}

export function resolutionConditionsFor(
  mode: ResolutionMode,
  target: ResolutionTarget,
): readonly string[] | undefined {
  if (mode === 'type') return ['types', 'import', 'default'];
  if (mode === 'web-dev' && target === 'web') return ['browser', 'development', 'import', 'default'];
  if (mode === 'web-build' && target === 'web') return ['browser', 'production', 'import', 'default'];
  if (mode === 'server' && target === 'server') return ['node', 'import', 'default'];
  if (mode === 'test' && target === 'shared') return ['test', 'import', 'default'];
  if (mode === 'test' && target === 'web') return ['browser', 'test', 'import', 'default'];
  if (mode === 'test' && target === 'server') return ['node', 'test', 'import', 'default'];
  return undefined;
}

export function isResolutionLogicalPath(path: string): boolean {
  if (
    path.length === 0
    || path.startsWith('/')
    || path.includes('\\')
    || path.includes('\0')
    || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(path)
  ) return false;

  const segments = path.split('/');
  return segments.every(segment => (
    segment.length > 0
    && segment !== '.'
    && segment !== '..'
    && segment !== '.pnpm'
    && segment !== 'node_modules'
  ));
}

function isExportSubpath(path: string): boolean {
  if (path === '.') return true;
  if (!path.startsWith('./') || path.includes('\\') || path.includes('\0')) return false;
  return path.slice(2).split('/').every(segment => segment.length > 0 && segment !== '.' && segment !== '..');
}

function sameConditionSet(actual: string[], expected: readonly string[]): boolean {
  return actual.length === expected.length
    && new Set(actual).size === actual.length
    && expected.every(condition => actual.includes(condition));
}

function sortAndDeduplicate(diagnostics: ResolutionRecordDiagnostic[]): ResolutionRecordDiagnostic[] {
  const unique = new Map<string, ResolutionRecordDiagnostic>();
  for (const diagnostic of diagnostics) unique.set(`${diagnostic.code}:${diagnostic.path}`, diagnostic);
  return [...unique.values()].sort((left, right) => (
    `${left.code}:${left.path}`.localeCompare(`${right.code}:${right.path}`)
  ));
}

export function normalizeResolutionRecord(input: ResolutionRecordInput): ResolutionRecordV1 {
  const diagnostics: ResolutionRecordDiagnostic[] = [];
  const conditions = resolutionConditionsFor(input.mode, input.target);

  if (conditions === undefined) {
    diagnostics.push({
      code: 'E_RESOLUTION_MODE_TARGET',
      path: 'mode',
      message: `Mode ${JSON.stringify(input.mode)} is not valid for target ${JSON.stringify(input.target)}.`,
    });
  } else if (!sameConditionSet(input.conditions, conditions)) {
    diagnostics.push({
      code: 'E_RESOLUTION_CONDITIONS',
      path: 'conditions',
      message: `Conditions for ${input.mode}/${input.target} must contain exactly ${conditions.join(', ')}.`,
    });
  }

  for (const [path, value] of [['importer', input.importer], ['logicalPath', input.logicalPath]] as const) {
    if (value !== undefined && !isResolutionLogicalPath(value)) {
      diagnostics.push({
        code: 'E_RESOLUTION_LOGICAL_PATH',
        path,
        message: `${path} ${JSON.stringify(value)} must be a repository-relative POSIX logical path.`,
      });
    }
  }

  const hasPackageIdentity = input.packageIdentity !== undefined;
  const hasExportSubpath = input.exportSubpath !== undefined;
  if (hasPackageIdentity !== hasExportSubpath) {
    const path = hasPackageIdentity ? 'exportSubpath' : 'packageIdentity';
    diagnostics.push({
      code: 'E_RESOLUTION_PACKAGE_SHAPE',
      path,
      message: `${path} is required when its package export identity counterpart is present.`,
    });
  } else if (input.exportSubpath !== undefined && !isExportSubpath(input.exportSubpath)) {
    diagnostics.push({
      code: 'E_RESOLUTION_PACKAGE_SHAPE',
      path: 'exportSubpath',
      message: `Export subpath ${JSON.stringify(input.exportSubpath)} must be "." or a non-traversing "./" subpath.`,
    });
  }

  if (input.format === 'external' && !input.external) {
    diagnostics.push({
      code: 'E_RESOLUTION_EXTERNAL_SHAPE',
      path: 'external',
      message: 'Format "external" requires external to be true.',
    });
  }
  if (input.external && input.format !== 'external') {
    diagnostics.push({
      code: 'E_RESOLUTION_EXTERNAL_SHAPE',
      path: 'format',
      message: `External records require format "external", received ${JSON.stringify(input.format)}.`,
    });
  }
  if (input.external && input.logicalPath !== undefined) {
    diagnostics.push({
      code: 'E_RESOLUTION_EXTERNAL_SHAPE',
      path: 'logicalPath',
      message: `External records cannot contain logicalPath ${JSON.stringify(input.logicalPath)}.`,
    });
  }
  if (!input.external && input.logicalPath === undefined) {
    diagnostics.push({
      code: 'E_RESOLUTION_LOGICAL_PATH',
      path: 'logicalPath',
      message: 'Non-external records require a logicalPath.',
    });
  }

  const stableDiagnostics = sortAndDeduplicate(diagnostics);
  if (stableDiagnostics.length > 0) throw new ResolutionRecordError(stableDiagnostics);

  return {
    schemaVersion: '1',
    importer: input.importer,
    specifier: input.specifier,
    mode: input.mode,
    target: input.target,
    ...(input.packageIdentity === undefined ? {} : { packageIdentity: input.packageIdentity }),
    ...(input.exportSubpath === undefined ? {} : { exportSubpath: input.exportSubpath }),
    ...(input.logicalPath === undefined ? {} : { logicalPath: input.logicalPath }),
    format: input.format,
    conditions: [...conditions!],
    external: input.external,
  };
}
