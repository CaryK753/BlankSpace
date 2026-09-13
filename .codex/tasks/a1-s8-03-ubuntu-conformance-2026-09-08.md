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
- [ ] Push the candidate, inspect every S2-S8 job and merge only when green.

## Evidence

- Capture run `34253202827`: 209 passed, 40 expected non-Chromium visual skips;
  artifact `10067015178` finalized with 27 review files.
- Ubuntu matrix hash:
  `be6a41b0fe50af9c9c1404bea20157d4c286977ec066b4e2dd63279d087d570c`.
- Manual review covered both Shells, compact/expanded, light/dark, destination
  heading focus, `Projects loaded` live announcement and zoomed layout.
- Candidate `f074568c53377eb12620621b1ab86b1ac2ffc745` kept S2-S7 green in runs
  `34253202839`, `34253202828`, `34253202906`, `34253202675`, `34253202712`
  and `34253202682`.

## Boundaries

- No production Product Shell or public UI API.
- No business UI, Identity, live API, native renderer or deployment work.
- macOS and Ubuntu screenshots remain separate evidence sets.
- Snapshot updates are allowed only in the explicit capture workflow; the final
  workflow compares checked-in Linux baselines without rewriting them.
