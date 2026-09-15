# A1-C2-02 Module runtime declarations loader

- Status: done
- Owner: wwj
- Date: 2026-09-15

## Goal

Load and validate content-addressed Module runtime declarations through the
existing Product Directory boundary without resolving them into Graph data.

## TODO

- [x] Freeze scope, acceptance criteria and non-goals in documentation.
- [x] Load declarations with the strict JSONC and canonical schema boundary.
- [x] Enforce owner containment, regular-file and canonical digest checks.
- [x] Cover accepted, rejected and cross-checkout deterministic records.
- [x] Run Node 24 build, typecheck, full tests and documentation verification.
- [x] Record evidence and identify the next bounded item.

## Boundaries

This item extends only the Product Directory loader. It does not select Service
providers, resolve Event compatibility, modify Product Graph or Executable
Registry, import entries, generate source, start Runtime or add dependencies.

## Evidence

- `loadProductDirectory` validates each referenced declarations file with the
  existing strict JSONC parser and the canonical V1 declarations schema.
- Missing files, non-files, post-symlink owner escape and canonical digest
  mismatch produce stable loader diagnostics; schema failures retain the
  existing configuration validation boundary.
- Modules without declarations remain unchanged. Loaded declarations contain no
  checkout paths, participate in `canonicalHash`, and produce byte-equal records
  across two absolute workspaces.
- Eight focused tests pass. Node 24 build, typecheck, full S1-S8 tests and
  documentation verification pass: 208 Vitest tests and 209 S8 browser tests
  passed, with 40 designed S8 skips. No schema, dependency or lockfile changed.

## Next boundary

No further work item is authorized. The next bounded item may adapt validated
declarations into explicit resolver input, but must first freeze provider and
Event compatibility diagnostics without changing Runtime behavior.
