export class BundleTraceReconciliationError extends Error {
  constructor(code, logicalPaths) {
    const kind = code === 'E_BUNDLE_MODULE_MISSING' ? 'missing' : 'unexpected';
    super(`${code} bundleModules: ${kind} workspace module(s): ${logicalPaths.join(', ')}.`);
    this.name = 'BundleTraceReconciliationError';
    this.code = code;
    this.path = 'bundleModules';
    this.logicalPaths = logicalPaths;
  }
}

export function reconcileBundleTrace(sourceEdges, bundleModules) {
  const expected = new Set(
    sourceEdges
      .filter(edge => !edge.external && edge.logicalPath !== undefined)
      .map(edge => edge.logicalPath),
  );
  const actual = new Set(bundleModules.map(module => module.logicalPath));

  const missing = [...expected].filter(path => !actual.has(path)).sort();
  if (missing.length > 0) {
    throw new BundleTraceReconciliationError('E_BUNDLE_MODULE_MISSING', missing);
  }

  const extra = [...actual].filter(path => !expected.has(path)).sort();
  if (extra.length > 0) {
    throw new BundleTraceReconciliationError('E_BUNDLE_MODULE_EXTRA', extra);
  }

  return { sourceModuleCount: expected.size, bundleModuleCount: actual.size };
}
