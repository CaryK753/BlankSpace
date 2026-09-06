export const CONTRACT_SCHEMA_VERSION = '1' as const;

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
