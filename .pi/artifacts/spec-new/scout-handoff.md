## Repository
- mihaiiova/pi-config, root /home/ops/projects/pi-config
- baseBranch `development`, releaseBranch `master` (origin/HEAD -> master); no `.pi/settings.json` currently (defaults apply)

## Context
- `AGENTS.md` + `docs/spec-lifecycle.md` — spec lifecycle states, settings schema (`spec.*` keys)
- `skills/spec-new/SKILL.md` — the phase under change (scout → grill-me interview → plan JSON → apply-plan.sh)
- `skills/grilling/SKILL.md` — general "interview relentlessly, one at a time" primitive (leave unchanged)

## Area touched
- `skills/spec-new/SKILL.md` — graded interview, test-seam gate, cross-cutting consistency check (prose)
- `extensions/pi-config/generate-settings.mjs` — `SPEC_KEYS` allowlist + `decisionThreshold` emission
- `extensions/pi-config/index.ts` + `generate-settings.d.mts` — interactive prompt + `PiConfig` type
- `scripts/spec/validate-settings.sh` — validate `spec.decisionThreshold` as number in [0,1]
- `docs/spec-lifecycle.md` — document the new key
- `tests/pi-config/generate-settings.test.mjs` and spec-settings validation coverage

## Design facts resolved
- `generate-settings.mjs` `SPEC_KEYS` is the single allowlist; `reconcileSpecBlock` drops unknown spec keys → `decisionThreshold` must be added there to survive reconciliation.
- `validate-settings.sh` currently validates only string/bool/object spec keys → needs a numeric branch for `decisionThreshold`.
- `/pi-config` currently prompts only for tiers/parentTier/subagentTiers; spec keys are inferred, not prompted. `decisionThreshold` is the first user-set spec key flowing from `.pi/pi-config.json` → `settings.spec.decisionThreshold`, so it needs a new `PiConfig` field + emission in `generateSettings`.
- `grilling` is the general primitive; the graded interview is `spec-new`-specific. Keep `grilling` unchanged.
- `ask_user_question` caps at 4 per call → "no cap" means loop until the queue is empty (transport detail).

## Open questions
- None blocking; all remaining choices (key name `spec.decisionThreshold`, default 0.6, presets + custom input) are recorded as Implementation Decisions in the spec.
