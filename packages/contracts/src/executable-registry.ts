import type { RuntimeTarget } from './product-graph.js';

export interface ExecutableRegistryEntryV1 {
  entryId: string;
  ownerId: string;
  target: RuntimeTarget;
  module: string;
  exportName: string;
}

export interface ExecutableRegistryBindingV1 {
  serviceId: string;
  providerId: string;
  entryId: string;
}

export interface ExecutableRegistryHandlerV1 {
  eventId: string;
  handlerId: string;
  entryId: string;
}

export interface ExecutableRegistryV1 {
  $schema: string;
  schemaVersion: '1';
  frameworkVersion: string;
  target: RuntimeTarget;
  assemblyId: string;
  entries: ExecutableRegistryEntryV1[];
  bindings: ExecutableRegistryBindingV1[];
  handlers: ExecutableRegistryHandlerV1[];
}
