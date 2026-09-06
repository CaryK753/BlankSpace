export type SourceResolutionDiagnosticCode =
  | 'E_PACKAGE_MANIFEST_INVALID'
  | 'E_PACKAGE_NOT_FOUND'
  | 'E_PRIVATE_EXPORT'
  | 'E_UNDECLARED_DEPENDENCY'
  | 'E_RUNTIME_EXPORT_MISSING'
  | 'E_PACKAGE_ESCAPE'
  | 'E_SYMLINK_ESCAPE'
  | 'E_PATH_CASE_MISMATCH'
  | 'E_RESOLUTION_NOT_FOUND'
  | 'E_RESOLUTION_AMBIGUOUS'
  | 'E_RELATIVE_EXTENSION_REQUIRED'
  | 'E_RESOLUTION_SPECIFIER_UNSUPPORTED';

export interface SourceResolutionDiagnostic {
  code: SourceResolutionDiagnosticCode;
  path: string;
  message: string;
}

export class SourceResolutionError extends Error {
  readonly diagnostics: [SourceResolutionDiagnostic];

  constructor(diagnostic: SourceResolutionDiagnostic) {
    super(`${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`);
    this.name = 'SourceResolutionError';
    this.diagnostics = [diagnostic];
  }
}

export function failSourceResolution(
  code: SourceResolutionDiagnosticCode,
  path: string,
  message: string,
): never {
  throw new SourceResolutionError({ code, path, message });
}
