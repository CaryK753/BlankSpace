# A1-S8-03 Ubuntu conformance

## Goal

Run the frozen S8 corpus on `ubuntu-24.04`, review a Linux-only Chromium
baseline, and make the resulting comparison a required, reproducible workflow.

## Status

- [x] Claim the sole ready work item and inspect the existing S8 runner.
- [x] Record runner, source, lock, browser and retained-artifact identity.
- [x] Capture and review the Ubuntu Chromium baseline in an isolated workflow.
- [x] Replace capture mode with the normal S8 comparison workflow.
- [ ] Run local Node.js 24 validation and update canonical status/evidence.
- [ ] Push the candidate, inspect every S2-S8 job and merge only when green.

## Boundaries

- No production Product Shell or public UI API.
- No business UI, Identity, live API, native renderer or deployment work.
- macOS and Ubuntu screenshots remain separate evidence sets.
- Snapshot updates are allowed only in the explicit capture workflow; the final
  workflow compares checked-in Linux baselines without rewriting them.
