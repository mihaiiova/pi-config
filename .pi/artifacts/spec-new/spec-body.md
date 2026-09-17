## Problem Statement

`/spec-new` interviews the user one decision at a time for every candidate decision, with no distinction between decisions that are genuinely the user's and facts/conventions resolvable from the repository. This causes question fatigue, asks questions the user should not have to answer, and lets definition gaps slip downstream: a spec with no concrete testing seam is only rejected at `/spec-start`, and decisions that contradict documented repo behavior (release/versioning flow, branch model, skill contracts) are only caught at `/spec-review`.

## Solution

Give `/spec-new` a graded interview. Every candidate decision is scored 0–1 across four dimensions — irreversibility, ambiguity, preference, blast radius — with a hard rule that a discoverable fact scores 0. Decisions at or above a configurable threshold (`spec.decisionThreshold`, default `0.6`) are surfaced as questions; everything below is decided from repo conventions/defaults and recorded with its rationale so the user can veto it. There is no cap on the number of surfaced questions. Each surfaced question carries a description — its grade, the reason for that grade, and a recommendation — so the user understands why it needs their input.

`/spec-new` also gains two definition-time checks so gaps are caught before a spec is marked ready:
- a concrete public testing seam must be named in Testing Decisions before publishing;
- a cross-cutting consistency pass flags decisions that conflict with documented repo behavior.

`decisionThreshold` is configurable per project via `/pi-config`.

## User Stories

1. As a developer, I am only asked decisions that are genuinely mine; facts and repo conventions are resolved without asking me.
2. As a developer, every question I am asked shows its grade, reason, and a recommendation, so I understand why it needs my input.
3. As a developer, no decision that needs my input is skipped — every question above the threshold surfaces, with no cap on count.
4. As a developer, I can tune how much I am asked per project via `/pi-config` (`decisionThreshold`).
5. As a developer, a spec with no concrete testing seam is rejected at definition time, not at `/spec-start`.
6. As a developer, decisions that contradict documented repo behavior are flagged during `/spec-new`, not at review.

## Implementation Decisions

- **Grading rubric.** `ask_grade = 0` when the answer is discoverable (a scout can resolve a fact or convention from code/docs/ADRs); otherwise `max(irreversibility, ambiguity, preference, blast_radius)`. Each dimension is 0–1, anchored:
  - *irreversibility* — 0 trivial rename … 1 public API/schema/migration/versioning;
  - *ambiguity* — 0 a repo convention or ADR decides … 1 several defensible answers, no precedent;
  - *preference* — 0 pure technical fact … 1 product/taste/business tradeoff only the user holds;
  - *blast radius* — 0 one file/spec … 1 shared contract other skills/people rely on.
  Max (not average): one decisive factor triggers the ask. The LLM records the grade and a one-line reason for every candidate decision.
- **Threshold.** `spec.decisionThreshold`, a number in `[0,1]`, default `0.6`. Lower = more questions/more agency; higher = fewer. Surfaced when `ask_grade >= decisionThreshold`; otherwise auto-decided from conventions/defaults.
- **No question cap.** Every decision at/above the threshold is asked, sorted by grade (descending), until the queue is empty. The underlying question tool's per-call limit is a transport detail, not a cap on what is asked.
- **Question description.** Each surfaced question presents, alongside the question text and options: the grade, the reason for the grade, and a recommendation. Auto-decided items are listed in the spec body under an "Auto-decided" section (decision + convention/default used + grade), and the user may veto any of them.
- **Where the rubric lives.** The grading is LLM judgement recorded in `skills/spec-new/SKILL.md`; it is not scripted. `grilling` remains the general one-at-a-time primitive and is unchanged.
- **Test-seam check.** `spec-new` requires Testing Decisions to name a concrete public seam (module/function), resolved by the scout, before publishing `spec:ready`; otherwise it stops with the gap explained.
- **Consistency check.** The scout handoff gains a "Cross-cutting consistency" section listing conflicts between proposed decisions and documented repo behavior (release/versioning flow, branch model, existing skill contracts). Conflicts are surfaced as high-grade questions or recorded as decisions.
- **`decisionThreshold` in `/pi-config`.** A new `PiConfig` field (e.g. `specDecisionThreshold`) is prompted in the `/pi-config` flow (presets plus a custom numeric input, prefilled from the current value, default `0.6`), stored in `.pi/pi-config.json`, and emitted by `generateSettings` into `.pi/settings.json` as `spec.decisionThreshold`. `SPEC_KEYS` in `generate-settings.mjs` gains `decisionThreshold` so it is preserved across reconciliation. `validate-settings.sh` validates it as a number in `[0,1]`, and `docs/spec-lifecycle.md` documents the key.

## Testing Decisions

- Unit-test `generate-settings`: `decisionThreshold` flows from the pi-config config into `settings.spec.decisionThreshold`; it is preserved on re-run (idempotent); it is absent when not configured.
- Unit-test `validate-settings.sh`: accepts numbers in `[0,1]`; rejects out-of-range numbers and non-numbers.
- Extend `tests/pi-config/generate-settings.test.mjs` and the spec-settings validation coverage under `tests/`.
- `spec-new` itself is skill prose; the rubric is documented, not unit-tested.

## Out of Scope

- Changing the general `grilling` skill's one-at-a-time behavior.
- Automating `/spec-start`, `/spec-review`, or `/spec-close` (separate future work).
- `/spec-release` — stays manual.
- A scripted implementation of the grading rubric (it is LLM judgement recorded in the skill).

## Further Notes

- The graded interview is the `/spec-new` layer; `grilling`/`grill-me` remains available as an escape hatch (e.g. `--interview`) when the user wants to decide incrementally.
- The 4-per-call limit of the question tool is a transport constraint; "no cap" means loop until the queue is empty, not a single call.
