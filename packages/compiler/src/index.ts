export {
  ConfigValidationError,
  JsoncSyntaxError,
  canonicalize,
  hashCanonical,
  parseJsonc,
  validateJsonc,
  type ConfigDiagnostic,
  type ConfigDiagnosticCode,
  type JsonObject,
  type JsonValue,
} from './config/jsonc.js';

export {
  ProductDirectoryError,
  loadProductDirectory,
  type LoadedProductDirectory,
  type LoadedProductModule,
  type ProductDirectoryDiagnostic,
  type ProductDirectoryDiagnosticCode,
} from './config/product-directory.js';

export {
  adaptProductDirectoryToGraphInput,
  buildProductDirectoryGraphs,
  type ProductDirectoryGraphOptions,
} from './config/product-directory-graph.js';

export {
  ProductGraphBuildError,
  buildMinimalProductGraphs,
  type MinimalGraphDiagnostic,
  type MinimalProductConfigInput,
  type MinimalProductEventBindingInput,
  type MinimalProductGraphInput,
  type MinimalProductManifestInput,
  type MinimalProductModuleInput,
  type MinimalProductServiceBindingInput,
} from './graph/minimal-product-graph.js';

export {
  ExecutableRegistryError,
  buildExecutableRegistry,
  verifyExecutableRegistry,
  type ExecutableRegistryAssembly,
  type ExecutableRegistryDiagnostic,
  type ExecutableRegistryDiagnosticCode,
} from './registry/executable-registry.js';

export {
  ResolutionRecordError,
  normalizeResolutionRecord,
  type ResolutionDiagnosticCode,
  type ResolutionRecordDiagnostic,
  type ResolutionRecordInput,
} from './resolution/normalize-resolution-record.js';

export {
  resolveSourceImport,
  type SourceImportPolicy,
  type SourceResolutionInput,
} from './resolution/source-resolver.js';

export {
  SourceResolutionError,
  type SourceResolutionDiagnostic,
  type SourceResolutionDiagnosticCode,
} from './resolution/source-resolution-error.js';

export {
  ImportPolicyError,
  enforceImportPolicy,
  type ImportBoundary,
  type ImportExpressionKind,
  type ImportPolicyDiagnostic,
  type ImportPolicyDiagnosticCode,
  type ImportPolicyInput,
  type ImportPolicyResult,
} from './resolution/import-policy.js';
