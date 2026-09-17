# Review: spec-review of #8 (startup drift check)
**Date:** 2026-09-16
**Session:** Review of spec/8-startup-drift-check — version marker plus pi-sync/reload drift detection

## History Checked
- `2026-09-16-spec-6-review.md`
- `2026-09-16-spec-7-review.md`

## Recurring Patterns
- Inline fan-out return truncation recovered from `status.json` (`workflow.value.output`) — also seen in spec-7. Not yet thrice, so no suggestion.

## Scores
| Dimension | Score |
|-----------|-------|
| Friction | 0.3 |
| Repetition | 0.3 |
| Missing capability | 0.2 |
| Knowledge gap | 0.3 |
| Fragility | 0.3 |

## Suggestions
No significant improvement opportunities found. (No dimension crossed 0.6.)

## Changes Made
- None (no accepted suggestions)

## Notes
- Two-axis code review ran via two read-only `reviewer` sub-agents (standards + spec). Reviewers cannot write files, so my "write report to path" instruction degraded to inline returns; full reports recovered from the workflow run's `status.json` (`workflow.value.output`).
- Both axes independently surfaced the same two defects, which were fixed in-scope: (1) the git drift signal compared `HEAD` vs `origin/HEAD` (the default branch), a permanent false "sync needed" on `development`/`spec/*` branches — now compares the current branch's remote counterpart; (2) the startup-check test asserted a bare `x.y.z` semver, which breaks after `/spec-release` bumps `development` to `<next-patch>-dev` — the regex now allows an optional prerelease suffix. Also removed a dead `diffPackages` import and bounded the `git fetch` with a 15s timeout.
- Residual (non-blocking): git/offline/reason wiring in `index.ts` is grep-asserted, not unit-tested, consistent with repo conventions; duplication with `pi-sync` helpers and a couple of naming/type smells were noted as judgement calls and left as-is.
