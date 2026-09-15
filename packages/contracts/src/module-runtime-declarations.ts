import type { RuntimeTarget } from './product-graph.js';

export type ModuleRuntimeEntryV1 = RuntimeTarget;

export interface ModuleDeclarationsReferenceV1 {
  readonly path: string;
  readonly sha256: string;
}

export interface ModuleServiceProviderV1 {
  readonly serviceId: string;
  readonly contractVersion: string;
  readonly providerId: string;
  readonly entry: ModuleRuntimeEntryV1;
  readonly capabilities?: readonly string[];
}

export interface ModuleEventHandlerV1 {
  readonly eventId: string;
  readonly versionRange: string;
  readonly handlerId: string;
  readonly entry: ModuleRuntimeEntryV1;
}

export interface ModuleRuntimeDeclarationsV1 {
  readonly $schema?: string;
  readonly schemaVersion: '1';
  readonly serviceProviders?: readonly ModuleServiceProviderV1[];
  readonly eventHandlers?: readonly ModuleEventHandlerV1[];
}
