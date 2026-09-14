# A1-C1-01 Product Directory loader

- Status: done
- Owner: wwj
- Date: 2026-09-14

## Goal

Turn the completed S1 configuration boundary into the first real Assembly
Compiler input: load and validate the root config, Product manifest, and
one-level Module descriptors without executing product code.

## TODO

- [x] Freeze scope, acceptance criteria and non-goals.
- [x] Implement stable loader diagnostics and normalized records.
- [x] Add accepted, allowlisted, duplicate, mismatch and escape fixtures.
- [x] Prove deterministic output across two absolute directories.
- [x] Run Node 24 build, typecheck, full tests and documentation verification.
- [x] Record evidence and identify the next bounded Assembly item.

## Boundaries

This item does not expand presets or Kits, select Service providers, modify the
Graph/Registry contracts, add a CLI or Runtime, or introduce dependencies.

## Evidence

- `loadProductDirectory` uses the production JSONC/Ajv boundary and canonical
  root, Product and Module schemas without executing product code.
- Eight filesystem tests cover deterministic discovery across two absolute
  directories, explicit exclusion, missing and invalid modules, nested
  discovery, duplicate IDs, directory-ID mismatch and symlink escape.
- Node 24 `pnpm build`, `pnpm typecheck`, `pnpm test` and `pnpm verify:docs`
  pass. S8 retained its existing lock-derived baseline and passed 209 browser
  tests with 40 designed skips.
- No dependency or lockfile change was required.

## Next boundary

No further work item is authorized. The next Assembly item should first freeze
how loaded Product Directory records feed the existing Product Graph builder;
it must not silently expand preset, Kit selection, CLI or Runtime scope.
