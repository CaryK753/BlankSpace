# A1-C1-04 Filesystem joint assembly

- Status: done
- Owner: wwj
- Date: 2026-09-15

## Goal

Compose the existing filesystem-to-Graph and Graph-to-Registry boundaries into
one deterministic API that returns a verified joint assembly per target.

## TODO

- [x] Freeze scope, acceptance criteria and non-goals.
- [x] Implement the filesystem-to-joint-assembly API.
- [x] Cover web/server target partition and assembly verification.
- [x] Prove byte-equal assemblies across absolute checkout directories.
- [x] Run Node 24 build, typecheck, full tests and documentation verification.
- [x] Record evidence and identify the next bounded Assembly item.

## Boundaries

This item only composes existing static generators. It does not define
Service/Event declarations, generate Registry source modules, import entry
code, start Runtime lifecycle, add CLI behavior or change dependencies.

## Evidence

- `buildProductDirectoryAssemblies` composes the existing validated loader,
  minimal Graph builder and pure Executable Registry generator.
- The web/server fixture returns stable target order, target-partitioned entries
  and matching Graph/Registry joint `assemblyId` values; every pair passes
  `verifyExecutableRegistry`.
- Two absolute fixture directories produce byte-equal assembly arrays without
  importing or executing their entry files.
- Node 24 build, typecheck, full S1-S8 tests and documentation verification
  pass: 174 Vitest tests and 209 S8 browser tests passed, with 40 designed S8
  skips. No schema, dependency or lockfile changed.

## Next boundary

No further work item is authorized. The next Assembly step requires a separate
schema/resolver decision for static Service/Event declarations before resolved
bindings can enter this filesystem assembly.
