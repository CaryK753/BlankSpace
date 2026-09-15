export const CONTRACT_SCHEMA_VERSION = '1' as const;

export type {
  ModuleDeclarationsReferenceV1,
  ModuleEventHandlerV1,
  ModuleRuntimeDeclarationsV1,
  ModuleRuntimeEntryV1,
  ModuleServiceProviderV1,
} from './module-runtime-declarations.js';

export type {
  ExecutableRegistryBindingV1,
  ExecutableRegistryEntryV1,
  ExecutableRegistryHandlerV1,
  ExecutableRegistryV1,
} from './executable-registry.js';

export type {
  ProductGraphDiagnosticV1,
  ProductGraphEntryV1,
  ProductGraphEventBindingV1,
  ProductGraphModuleV1,
  ProductGraphServiceBindingV1,
  ProductGraphV1,
  RuntimeTarget,
} from './product-graph.js';

export type {
  ResolutionFormat,
  ResolutionMode,
  ResolutionRecordV1,
  ResolutionTarget,
} from './resolution-record.js';
