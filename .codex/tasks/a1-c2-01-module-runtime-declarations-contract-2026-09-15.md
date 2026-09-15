# A1-C2-01 Module runtime declarations contract

- Status: done
- Owner: wwj
- Date: 2026-09-15

## Goal

Freeze the smallest strict, content-addressed Module contract for statically
declared Service providers and Event handlers before any loader or resolver
consumes it.

## TODO

- [x] Freeze scope, acceptance criteria and non-goals in documentation.
- [x] Define the canonical declarations schema and descriptor reference.
- [x] Export matching TypeScript contract types.
- [x] Cover accepted documents and stable rejection boundaries.
- [x] Run Node 24 build, typecheck, full tests and documentation verification.
- [x] Record evidence and identify the next bounded item.

## Boundaries

This item defines data only. It does not load or hash declaration files, select
providers, resolve handlers into a Product Graph, generate Registry source,
import entries, start Runtime lifecycle, or add dependencies. API, UI, Job,
migration and policy declarations remain outside this V1 slice.

## Evidence

- `module.schema.json` accepts only an owner-relative declarations path and a
  64-character lowercase SHA-256 reference.
- `module-runtime-declarations-v1.schema.json` freezes strict Service provider
  and Event handler records bound to `web` or `server` entries.
- Public readonly TypeScript types mirror both contracts.
- Thirteen focused tests cover valid records and strict identifier, version,
  range, duplicate, target, path, digest and unknown-field rejection.
- Node 24 build, typecheck, full S1-S8 tests and documentation verification
  passed: 200 Vitest tests and 209 S8 browser tests passed, with 40 designed S8
  skips. No dependency or lockfile changed.

## Next boundary

No further work item is authorized. A separately documented item may teach the
Product Directory loader to read the referenced JSONC, verify canonical SHA-256
and preserve owner-relative records without yet resolving them into Graph data.
