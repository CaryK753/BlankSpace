# A1-S8-03 Ubuntu conformance

## Goal

Run the frozen S8 corpus on `ubuntu-24.04`, review a Linux-only Chromium
baseline, and make the resulting comparison a required, reproducible workflow.

## Status

- [x] Claim the sole ready work item and inspect the existing S8 runner.
- [x] Record runner, source, lock, browser and retained-artifact identity.
- [x] Capture and review the Ubuntu Chromium baseline in an isolated workflow.
- [x] Replace capture mode with the normal S8 comparison workflow.
- [x] Run local Node.js 24 validation and update canonical status/evidence.
- [x] Push the candidate, inspect every S2-S8 job and merge only when green.

## Evidence

- Latest capture run `34735655529`: 209 passed, 40 expected non-Chromium visual
  skips; artifact `10311127151` finalized on runner image `20260907.300.1`.
- Ubuntu matrix hash:
  `be6a41b0fe50af9c9c1404bea20157d4c286977ec066b4e2dd63279d087d570c`.
- Manual review covered both Shells, compact/expanded, light/dark, destination
  heading focus, `Projects loaded` live announcement and zoomed layout.
- Candidate `f074568c53377eb12620621b1ab86b1ac2ffc745` kept S2-S7 green in runs
  `34253202839`, `34253202828`, `34253202906`, `34253202675`, `34253202712`
  and `34253202682`.
- Comparison run `34735554216` correctly rejected GitHub runner image drift from
  `20260831.293.1` to `20260907.300.1` before browser execution; the replacement
  baseline was captured and all 20 PNG hashes matched the prior reviewed set.
- Final comparison run `34751706885` passed 209/40, the no-rewrite assertion and
  artifact `10316506341`; S2-S7 runs `34751706900`, `34751706970`, `34751706886`,
  `34751706897`, `34751707014` and `34751706903` all passed on the same commit.

## Boundaries

- No production Product Shell or public UI API.
- No business UI, Identity, live API, native renderer or deployment work.
- macOS and Ubuntu screenshots remain separate evidence sets.
- Snapshot updates are allowed only in the explicit capture workflow; the final
  workflow compares checked-in Linux baselines without rewriting them.
