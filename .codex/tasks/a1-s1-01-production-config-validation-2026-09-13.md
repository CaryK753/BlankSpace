# A1-S1-01 Production config validation

- Status: done
- Owner: wwj
- Date: 2026-09-13

## Goal

Replace the handwritten compiler JSONC parser with the already locked
`jsonc-parser` implementation, add an Ajv-backed validation boundary, and
freeze stable source and schema diagnostics without changing canonical output.

## TODO

- [x] Reconcile the remaining S1 provisional gate with the Phase 1A DAG.
- [x] Freeze scope, acceptance criteria and non-goals in the work-item file.
- [x] Implement production parser and schema validation diagnostics.
- [x] Add accepted/rejected and diagnostic regression tests.
- [x] Run Node 24 build, typecheck, full tests and documentation verification.
- [x] Record reproducible local evidence and unlock A1-S1-02.

## Boundaries

This item does not add dependencies, discover configuration files, expand
presets, implement the CLI or Runtime, or claim cross-platform S1 conformance.

## Evidence

On macOS arm64 with Node 24.20.0 and pnpm 10.32.1, nine focused production
boundary tests and all 156 Vitest tests passed. The complete S1-S8 command also
passed, including the legacy and production S1 corpus and the
209-pass/40-designed-skip S8 browser matrix. Build, typecheck and documentation
verification passed. Special object keys are preserved in null-prototype data
objects, preventing `__proto__` from mutating the parsed object prototype.
The root manifest and lock importer both pin Ajv 8.20.0 and jsonc-parser 3.3.1
exactly; no dependency node changed.
