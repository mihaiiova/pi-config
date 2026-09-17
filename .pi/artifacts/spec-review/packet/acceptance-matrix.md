# Acceptance-criteria matrix — Spec #10

Each requirement is quoted from the spec, with stable IDs assigned. Evidence must name a changed file/hunk or a test. `met` requires code/test evidence; a practical behavior with no regression test is `partial`.

| ID | Requirement | Evidence in diff |
|---|---|---|
| R1 | "Add a focused `extensions/project-state/` extension with separate schema/type, persistence, lifecycle, metadata, and presentation modules" | `extensions/project-state/{index.ts,schema.mjs,state.mjs,metadata.mjs,presentation.mjs}` + `.d.mts` typings |
| R2 | "maintain a mutable `.pi/state.json` resume projection and immutable `.pi/sessions/<filesystem-safe-session-id>.json` records" | `state.mjs` (`statePath`, `sessionsDir`, `sessionRecordPath`, `sanitizeSessionId`) |
| R3 | "Project configuration remains `.pi/settings.json` and `.pi/pi-config.json`; runtime state/logs are ignored by git by default" | `.gitignore` (`.pi/state.json`, `.pi/sessions/`) |
| R4 | "initialize/load state and an in-memory session record on `session_start`; ... write a finalized session record on `session_shutdown`; persist a minimal projection before compaction" | `index.ts` `pi.on("session_start"|"session_shutdown"|"session_before_compact")` |
| R5 | "Use Pi session manager/header/model/context-usage APIs ... only where their values are reliable. Omit/null unavailable facts; do not infer telemetry or manually price models" | `index.ts` (`ctx.sessionManager`, `activeModel`, `liveUsage`), `metadata.mjs` (nulls, no pricing) |
| R6 | "State contains only current active spec, lifecycle phase, branch, last session ID, pending work/checks when reliably known, update time, and `schemaVersion`" | `schema.mjs` `createStateDocument` (field set); `index.ts` reconciliation |
| R7 | "Final session records are write-once ... filename ID is stable and filesystem-safe; finalization must never overwrite an existing final record" | `state.mjs` `finalizeSession` (`exists` no-op, hard-link create-once); `sanitizeSessionId` |
| R8 | "Each record has `schemaVersion`, timestamps, resolved project context ..., concise summary/outcome ..., changed files/check results ..., agent/skill/model usage ..., and version/config provenance" | `schema.mjs` `createSessionDocument` |
| R9 | "Provenance includes pi-config commit SHA, installed Pi version, effective parent/subagent models and thinking levels ..., and a stable hash/reference for active configuration" | `metadata.mjs` `collectProvenance`/`configHash`/`readPiConfigCommit`; `index.ts` `readSubagentModels` |
| R10 | "Product `package.json` version and Pi session-format version are represented distinctly" | `metadata.mjs` `readProductVersion`; `index.ts` `VERSION` + `CURRENT_SESSION_VERSION` |
| R11 | "Register concise read-only commands: `/session-status`, `/session-history`, `/session-cost`" | `index.ts` `registerCommand(...)` x3 |
| R12 | `/session-status` "current projection, branch/spec/phase/pending/current-session cost if known" | `presentation.mjs` `formatStatus` |
| R13 | `/session-history` "recent date/summary/spec/outcome/cost" | `presentation.mjs` `formatHistory` |
| R14 | `/session-cost` "current plus limited recent/project aggregate known cost" | `presentation.mjs` `formatCost` |
| R15 | "Keep `/spec-cost` intact; expose documented, stable session-record fields" | `index.ts` (no `spec-cost`); `README.md` + `docs/spec-lifecycle.md` |
| R16 | "add targeted ignore rules ... do not ignore existing version-controlled `.pi` configuration or alter unrelated repositories" | `.gitignore` (targeted two rules only) |
| R17 | "every persisted ... document starts with `schemaVersion: 1`; loaders dispatch through explicit migration/version handling and reject unsupported/malformed documents safely" | `schema.mjs` `SCHEMA_VERSION`/`migrateDocument`; `state.mjs` `loadState`/`listSessions` |
| R18 | "write final records with exclusive/create-once semantics and safe temporary-file/rename behavior ... an existing final ID is an error/no-op, never an update" | `state.mjs` `finalizeSession` (tmp + hard-link + EEXIST→exists) |
| R19 | "use ExtensionAPI lifecycle events ..., `ReadonlySessionManager` header/ID/path/entries, model/context usage ... only for facts actually exposed" | `index.ts` lifecycle + `ctx.sessionManager.getSessionId()/getSessionFile()/getEntries()` |
| R20 | "record Pi-provided usage/cost totals and native usage breakdowns when present ... omit or set `null` for unavailable fields" | `metadata.mjs` `aggregateUsage` (null/zero defaults) |
| R21 | "do not modify `apply-plan.sh` ... or replace `/spec-start` ... `/spec-cost`. Integrate/reconcile around their existing label model" | no changes to `scripts/spec/*`, `skills/spec-*` |
| R22 | "provide the three concise commands in the new extension, read from project-local data, and do not make `/spec-status` write state" | `index.ts` read-only handlers |
| R23 | "Use the repository's Node `node:assert/strict` temporary-directory test convention and wire the new suite into its area test runner" | `tests/project-state/*.test.mjs` + `tests/project-state/test.sh` |
| R24 | Tests cover "initial/missing `.pi` creation; state read/write and `schemaVersion`; atomic serialization stability; malformed and unsupported-version files; future migration dispatch; session creation/finalization; final-record no-overwrite immutability; multiple sessions; unavailable version metadata fields; isolated temporary filesystem behavior" | `state.test.mjs`, `schema.test.mjs`, `metadata.test.mjs` |
| R25 | "Command/lifecycle integration tests must assert registration and safe behavior" | `tests/project-state/test.sh` (source-layout grep assertions) |
| R26 | "Clarify documentation that local state/session records are runtime observability/resume data, not planning artifacts ... Document file locations, persisted versus deliberately unpersisted data, version semantics, commands, config-hash/reference approach, and ignore behavior" | `docs/spec-lifecycle.md`, `extensions/project-state/README.md`, `README.md` |
| R27 | "distinguish product version ..., pi-config git commit, installed Pi package version, and Pi session-format version" | `metadata.mjs` `collectProvenance` + `schema.mjs` provenance block |
| R28 | "preserve current `worker`, `scout`, `reviewer`, and `oracle` routing rather than hard-coding model IDs" | `index.ts` `readSubagentModels` reads `subagents.agentOverrides` (no hard-coded IDs) |

## Out-of-scope (must be absent)

| ID | Requirement | Expected evidence |
|---|---|---|
| O1 | No eval/scoring/memory/dashboards/analytics UI/retention controls | none present in diff |
| O2 | No manual pricing/guessed token/cost/agent telemetry | `metadata.mjs` never computes price |
| O3 | No replacement of Pi sessions/subagents/routing/labels/git/`/spec-cost` | no changes to those surfaces |
| O4 | No runtime-state changes in unrelated projects | `.gitignore` only adds the two project-state rules |
