# Code review packet — Spec #9

## Scope
- Mode: branch review against `development`
- Base: `a9d6bcdaf4c1ae9bc2ecd2ba65384a5ecafca79a`
- Head: `ca52ead` (`spec/9-spec-new-graded-interview`)
- Diff command: `git diff development...HEAD`
- Commits:
  - `3178cb6 spec(9): add spec.decisionThreshold plumbing and validation`
  - `ca52ead spec(9): document graded interview, test-seam and consistency checks`
- Changed files: docs/spec-lifecycle.md; extensions/pi-config/generate-settings.d.mts; extensions/pi-config/generate-settings.mjs; extensions/pi-config/index.ts; scripts/spec/validate-settings.sh; skills/spec-new/SKILL.md; tests/pi-config/generate-settings.test.mjs; tests/pi-config/test.sh; tests/pi-config/validate-settings.test.sh.
- Stat: 9 files, 220 insertions, 4 deletions.
- Full patch: available with the diff command above; reviewers may read it directly as needed.

## Validation
- PASS `./tests/pi-config/test.sh`, run via `scripts/spec/run-checks.sh`; full output log: `.pi/artifacts/spec-review/20260917T092114Z-3546173/test.log`.
- No project package scripts, lint config, or tsconfig exists; no additional documented check commands are configured in `.pi/settings.json`.
- `git diff --check development...HEAD` passed.

## Spec source
GitHub issue #9, “Spec: /spec-new — graded interview, test-seam and consistency checks.”

### Requirements / acceptance matrix (parent draft)
| ID | Requirement | Evidence in diff | Status |
|---|---|---|---|
| AC1 | Grade candidate decisions: discoverable facts score 0; others use max of the four anchored dimensions, recording grade and reason. | skills/spec-new/SKILL.md graded interview rubric | met (skill prose) |
| AC2 | Surface every decision at/above configurable threshold, sorted descending, no cap; question has grade/reason/recommendation; auto-decided decisions record convention/default/grade and can be vetoed. | skills/spec-new/SKILL.md Threshold, Asking, Auto-decided sections | met (skill prose) |
| AC3 | `spec.decisionThreshold` default 0.6 and `/pi-config` supports presets/custom 0–1, preserving current value. | extensions/pi-config/index.ts threshold constants and interaction flow | partial: not behavior-tested |
| AC4 | Persist the config choice in `.pi/pi-config.json`; emit `spec.decisionThreshold` in `.pi/settings.json`; configured value wins stale value and reconciliation preserves it. | index.ts nextConfig; generate-settings.mjs; generate-settings.test.mjs | met |
| AC5 | Settings validator accepts numbers 0–1 and rejects invalid values. | scripts/spec/validate-settings.sh; validate-settings.test.sh | met |
| AC6 | Documentation describes `decisionThreshold`. | docs/spec-lifecycle.md | met |
| AC7 | Before publishing ready, require a scout-resolved named concrete public testing seam. | skills/spec-new/SKILL.md Test-seam check and scout scope | met (skill prose) |
| AC8 | Before publishing, check proposed decisions against documented release/versioning, branches, and skill contracts; surface conflicts as high-grade questions or record decisions. | skills/spec-new/SKILL.md Consistency check and scout scope | met (skill prose) |

## Standards sources
- `AGENTS.md` (project workflow / package conventions)
- No root CONTRIBUTING.md or CODING_STANDARDS.md.
- Smell baseline: `/home/ops/projects/pi-config/skills/code-review/references/smell-baseline.md`

## Full selected issue text
The issue says /spec-new currently asks every candidate decision. Implement a graded interview: score every candidate decision from 0–1 across irreversibility, ambiguity, preference, and blast radius; discoverable facts score 0; otherwise use max. `spec.decisionThreshold` defaults to 0.6; all decisions at or above it are asked in descending-grade order with no cap, grade/reason/recommendation. Lower-score decisions are resolved from conventions/defaults and recorded under Auto-decided, allowing a veto. A concrete public test seam must be named in Testing Decisions before publishing ready. A cross-cutting consistency pass must flag conflicts with documented release/versioning flow, branch model, and skill contracts. `/pi-config` should prompt presets/custom numeric value, persist `specDecisionThreshold`, generate `spec.decisionThreshold`, preserve it through reconciliation, and validate numbers in [0,1]. Tests cover generator flow/idempotency/absence and validator valid/invalid bounds/types. Out of scope: changing grilling, automating other lifecycle skills, release work, or scripting the LLM grading rubric.
