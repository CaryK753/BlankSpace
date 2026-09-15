# A1-C1-03 Entry filesystem boundary

- Status: done
- Owner: wwj
- Date: 2026-09-14

## Goal

Close the documented Product/Module entry boundary before Graph generation:
every declared entry must be an existing regular file inside its owner after
symlink resolution, without importing or executing it.

## TODO

- [x] Freeze scope, acceptance criteria and non-goals.
- [x] Implement owner-bounded entry validation.
- [x] Cover valid files, missing files, directories and symlink escape.
- [x] Preserve logical paths and checkout-independent Graph output.
- [x] Run Node 24 build, typecheck, full tests and documentation verification.
- [x] Record evidence and identify the next bounded Assembly item.

## Boundaries

This item does not define Service/Event declarations, import or execute entry
code, scan source imports, change Graph/Registry schemas, or add CLI, Runtime
or dependency behavior.

## Evidence

- The loader resolves Product entries against the Product owner and Module
  entries against their Module owner, then requires an existing regular file.
- Symlink resolution happens before owner containment checks; entry code is
  never imported or executed and returned logical descriptors stay unchanged.
- Five focused tests cover a valid Product entry, missing Product and Module
  entries, a directory in place of a file, and Product symlink escape.
- Node 24 build, typecheck, full S1-S8 tests and documentation verification
  pass: 172 Vitest tests and 209 S8 browser tests passed, with 40 designed S8
  skips. No schema, dependency or lockfile changed.

## Next boundary

No further work item is authorized. Service/Event declarations cannot be
implemented by inventing Module fields: `docs/product-modules.md` requires the
corresponding schema major and resolver decision to be frozen first.
