# A1-S1-02 Cross-platform config conformance

- Status: done
- Owner: wwj
- Date: 2026-09-13

## TODO

- [x] Freeze a canonical production-parser diagnostic transcript.
- [x] Add Linux, macOS and Windows Node 24 workflow coverage.
- [x] Preserve the S2-S8 regression workflows.
- [x] Inspect actual GitHub check-runs and failed logs.
- [x] Mark S1 pass only after all platform evidence matches.

## CI observations

- PR #5 candidate `c42d4a2`: S1 run 34753520442 passed Ubuntu, macOS and
  Windows; S2-S7 also passed.
- S8 run 34753524664 failed before browser execution because exact dependency
  specifiers changed the lockfile hash. Runner image 20260907.300.1, tool
  versions, source hash and fixture hash matched the reviewed baseline. The
  deterministic macOS/Linux lock-derived transcript hashes were refreshed;
  this still requires a new comparison run before acceptance.

## Final evidence

- S1 run 34753663983 passed all three operating systems.
- S2-S7 runs 34753664027, 34753664011, 34753664007, 34753664029,
  34753663987 and 34753664004 passed.
- S8 run 34753664043 passed 209 tests with 40 designed skips, retained the
  canonical transcript, and finalized artifact 10316534104.
