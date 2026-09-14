# A1-C1-02 Product Directory to Graph

- Status: done
- Owner: wwj
- Date: 2026-09-14

## Goal

Connect the schema-validated Product Directory output to the existing minimal
Product Graph builder without adding another discovery or execution boundary.

## TODO

- [x] Freeze scope, acceptance criteria and non-goals.
- [x] Implement the pure Product Directory record adapter.
- [x] Add the integrated filesystem-to-Graph entry.
- [x] Cover Product-relative and Module-relative entry resolution.
- [x] Prove byte-equal Graphs across two absolute checkout directories.
- [x] Run Node 24 build, typecheck, full tests and documentation verification.
- [x] Record evidence and identify the next bounded Assembly item.

## Boundaries

This item does not infer Service/Event bindings, scan source imports, change
Graph/Registry schemas, generate an Executable Registry, or add preset, Kit,
CLI, Runtime or dependency behavior.

## Evidence

- `adaptProductDirectoryToGraphInput` maps schema-validated records into the
  existing builder input without I/O; `buildProductDirectoryGraphs` composes
  the loader and builder as the first filesystem-to-Graph API.
- Product entries resolve from the Product directory and Module entries from
  their owning Module. Shared entries remain descriptors because V1 runtime
  targets are only `web | server`.
- Three integration tests extend the Product Directory corpus to 11 scenarios
  and prove normalized paths, byte-equal Graphs across absolute directories,
  and preservation of the existing Graph diagnostic boundary.
- Node 24 build, typecheck, full S1-S8 tests and documentation verification
  pass: 167 Vitest tests and 209 S8 browser tests passed, with 40 designed S8
  skips. No schema, dependency or lockfile changed.

## Next boundary

No further work item is authorized. The next Assembly item should freeze the
static Service/Event declaration input needed before Graph and Executable
Registry integration; it must not infer declarations from executable code.
