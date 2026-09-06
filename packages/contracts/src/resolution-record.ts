export type ResolutionMode = 'type' | 'web-dev' | 'web-build' | 'server' | 'test';

export type ResolutionTarget = 'shared' | 'web' | 'server';

export type ResolutionFormat = 'esm' | 'json' | 'asset' | 'external';

export interface ResolutionRecordV1 {
  schemaVersion: '1';
  importer: string;
  specifier: string;
  mode: ResolutionMode;
  target: ResolutionTarget;
  packageIdentity?: string;
  exportSubpath?: string;
  logicalPath?: string;
  format: ResolutionFormat;
  conditions: string[];
  external: boolean;
}
