export const CONTRACT_SCHEMA_VERSION = '1' as const;

export type {
  ExecutableRegistryBindingV1,
  ExecutableRegistryEntryV1,
  ExecutableRegistryHandlerV1,
  ExecutableRegistryV1,
} from './executable-registry.js';

export type {
  ProductGraphDiagnosticV1,
  ProductGraphEntryV1,
  ProductGraphModuleV1,
  ProductGraphV1,
  RuntimeTarget,
} from './product-graph.js';

export type {
  ResolutionFormat,
  ResolutionMode,
  ResolutionRecordV1,
  ResolutionTarget,
} from './resolution-record.js';
