export type RuntimeTarget = 'web' | 'server';

export interface ProductGraphModuleV1 {
  id: string;
  descriptor: string;
}

export interface ProductGraphEntryV1 {
  entryId: string;
  ownerId: string;
  target: RuntimeTarget;
  module: string;
  exportName: string;
}

export interface ProductGraphDiagnosticV1 {
  code: string;
  severity: 'warning';
  message: string;
}

export interface ProductGraphV1 {
  $schema: string;
  schemaVersion: '1';
  frameworkVersion: string;
  target: RuntimeTarget;
  inputHash: string;
  assemblyId: string;
  modules: ProductGraphModuleV1[];
  entries: ProductGraphEntryV1[];
  diagnostics: ProductGraphDiagnosticV1[];
}
