## Review

**Correct — documented standards:** No hard violations found. `AGENTS.md` ("extensions live in `extensions/<name>/`") and README "Adding a new custom extension" (`extensions/<name>/index.ts`) are both satisfied by `extensions/project-state/index.ts`. The `.mjs` + `.d.mts` companion split matches existing extensions (`startup-check/drift-check.mjs`+`.d.mts`, `pi-config/generate-settings.mjs`+`.d.mts`), and `tests/project-state/{test.sh,*.test.mjs}` mirrors `tests/startup-check/`. `.pi/settings.json` `subagents.agentOverrides` (read at `index.ts:112`) is the real settings shape, so `README.md:55` is accurate.

**Finding: P2 — Duplicated Code.** Identical projection clump twice:
```ts
writeStateAtomic(piDir, createStateDocument({
  activeSpec: currentSession?.activeSpec ?? null, phase: ..., branch: ...,
  checks: readChecks(piDir), lastSessionId: loadStateSafe(piDir)?.lastSessionId ?? null }))
```
`extensions/project-state/index.ts:208-216` (reload) and `:251-259` (before_compact) are byte-identical; `:169-175` carries the same 5-field clump. Smallest fix: one `persistProjection(piDir, {activeSpec, phase, branch})` helper called from all three hooks.

**Finding: P2 — Speculative Generality.** `pendingWork` (`schema.mjs:106`, `schema.d.mts:12`, `presentation.mjs:27`) and `checkResults` (`schema.mjs:147`, `schema.d.mts:54`) are never populated anywhere. Exhaustive repo grep finds them only in schema defaults, type declarations, and tests; `/session-status` can therefore only ever print `pending: (none)`. Either populate from a real source or drop both fields until one exists.

**Finding: P2 — Divergent Change.** `index.ts:47-133` mixes Pi command/hook registration with git/gh/fs reconciliation (`currentBranch`, `deriveActiveSpec`, `readGhSpecPhase`, `changedFiles`, `readChecks`/`readVersionFile`/`readSubagentModels`), while the file header (`index.ts:11-12`) states pure modules exist so logic is unit-testable. The riskiest logic — the `spec/<n>-` regex, the `gh --jq` label pick, the porcelain `" -> "` rename split — is covered only by grep assertions in `tests/project-state/test.sh`. Moving reconciliation into a `.mjs` module buys real unit tests.

**Finding: P2 (minor) — Duplicated/inefficient reads.** `readJsonFile(join(piDir, "settings.json"))` runs three times per `session_start` (`index.ts:99,105,111`). Read once, pass the parsed object down.

**Non-findings:** README tree line `project-state/#` is column-aligned with `pi-sync/      #` (14 chars each); the off-by-one on `skills-select/ #` is pre-existing, not from this diff.

**Merge verdict: OK with notes** — no standard breaches; the four items above are optional cleanups.