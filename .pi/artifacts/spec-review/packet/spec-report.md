## Review

### Step 1 — Corrected acceptance-criteria matrix

Evidence verified against the diff at `/home/ops/projects/pi-config/.pi/artifacts/spec-review/packet/10.diff`, HEAD tree, and `node_modules/@earendil-works/pi-coding-agent/dist/{index.d.ts,core/extensions/types.d.ts,core/session-manager.d.ts}`. Changes vs. the parent matrix are marked ✱.

| ID | Requirement (abbrev.) | Evidence | Status |
|---|---|---|---|
| R1 | Focused extension with separate schema/type, persistence, lifecycle, metadata, presentation modules | `index.ts` (lifecycle) + `schema.mjs`, `state.mjs`, `metadata.mjs`, `presentation.mjs` + 4 `.d.mts` typings | met |
| R2 | mutable `.pi/state.json` + immutable `.pi/sessions/<safe-id>.json` | `state.mjs` `statePath`/`sessionsDir`/`sessionRecordPath`/`sanitizeSessionId`; runtime sample `.pi/state.json` | met |
| R3 | config stays `.pi/settings.json`/`pi-config.json`; runtime ignored | `.gitignore` +2 rules; no change to the two config files | met |
| R4 | `session_start` load/init, `session_shutdown` finalize, pre-compaction projection | `index.ts` 3 handlers; `session_before_compact` exists (`core/extensions/types.d.ts:442,873`) | met |
| R5 | Use native session/model/usage APIs + reliable subagent artifacts; null the rest | `index.ts` `ctx.sessionManager`, `activeModel`, `liveUsage`; `metadata.mjs` nulls, no pricing | **partial** ✱ |
| R6 | State holds only spec/phase/branch/last session/pending/checks/update time/schemaVersion | `schema.mjs:97-113` field set == allowed set; runtime `.pi/state.json` keys | met |
| R7 | Write-once records, stable filesystem-safe filename id | `state.mjs` `finalizeSession` (`exists` no-op then hard-link EEXIST); `state.test.mjs` §7 | met |
| R8 | Record: schemaVersion, timestamps, project context, summary/outcome, changed files/checks, agent/skill/model usage, provenance | `schema.mjs:123-168`; `index.ts:183-197,223-232` | **partial** ✱ |
| R9 | Provenance: pi-config commit, Pi version, effective parent/subagent models + thinking levels, config hash | `metadata.mjs` `collectProvenance`/`configHash`/`readPiConfigCommit`; `index.ts:110-115`, `activeModel` (thinkingLevel) | met |
| R10 | Product version and Pi session-format version distinct | `metadata.mjs:readProductVersion`; `index.ts` `VERSION` + `CURRENT_SESSION_VERSION` (=3) → separate provenance keys | met |
| R11 | Register `/session-status`, `/session-history`, `/session-cost` | `index.ts:262,274,286` `registerCommand` | met |
| R12 | `/session-status`: projection, branch/spec/phase/pending/cost | `presentation.mjs:17-31`; `presentation.test.mjs` §1 | met |
| R13 | `/session-history`: date/summary/spec/outcome/cost | `presentation.mjs:37-54`; `presentation.test.mjs` §2 | met |
| R14 | `/session-cost`: current + limited recent + aggregate | `presentation.mjs:60-83`; `presentation.test.mjs` §3 | met |
| R15 | `/spec-cost` intact; documented stable record fields | no diff under `skills/spec-cost/` or `scripts/spec/`; `test.sh` asserts source never mentions `spec-cost`; `extensions/project-state/README.md` "What is recorded" | met |
| R16 | Targeted rules; don't ignore committed `.pi`; update the setup path so configured projects get the rules | `.gitignore` +`.pi/state.json`, +`.pi/sessions/` only; **no** change to `skills/spec-init/SKILL.md` or `extensions/pi-config/`; only prose at `extensions/project-state/README.md:26-27` | **partial** |
| R17 | `schemaVersion: 1` + migration dispatch, reject unsupported/malformed | `schema.mjs` `SCHEMA_VERSION`/`migrateDocument` (`schema.test.mjs` §3-6); `state.mjs` `loadState`, `listSessions` (import `./schema.mjs`) | met |
| R18 | Exclusive create-once + safe tmp/rename; existing id is error/no-op | `state.mjs` `finalizeSession` (`tmp` → `linkSync` → unlink; `EEXIST`→`exists`); `state.test.mjs` §7,10 | met |
| R19 | Native lifecycle + `ReadonlySessionManager` header/ID/path/entries, model/context usage | lifecycle ✓, `getSessionId()/getSessionFile()/getEntries()` ✓; **`getHeader()` never called** (grep: 0 hits) | **partial** ✱ |
| R20 | Pi-provided usage/cost totals and native breakdowns; null when absent | `metadata.mjs` `aggregateUsage` (`metadata.test.mjs` §1-3) — main agent only, no per-agent breakdown | **partial** ✱ |
| R21 | Don't modify `apply-plan.sh`/lifecycle skills; reconcile around labels | diff touches no `scripts/spec/*` or `skills/spec-*`; label vocabulary matched in `readGhSpecPhase` | met |
| R22 | Three read-only commands from project-local data; `/spec-status` doesn't write | handlers only read (`index.ts:267-299`); no change to spec-status | met |
| R23 | Repo `node:assert/strict` tmpdir convention + wire suite into area runner | 4 `tests/project-state/*.test.mjs` (mkdtemp isolation) + `tests/project-state/test.sh` invoking all four (same shape as `tests/pi-config/test.sh:38`) | met |
| R24 | Ten listed test areas | `state.test.mjs` §2-10, `schema.test.mjs` §1-8, `metadata.test.mjs` §1-7, `presentation.test.mjs` §1-3 | met |
| R25 | Integration tests assert registration and safe behavior | `test.sh` registration greps + no `ctx.ui.confirm`/`select` + no global-settings path (repo extension-source convention). Handler-level safety unasserted | met (see P2 note) |
| R26 | Docs: runtime data not planning artifacts; locations, persisted vs unpersisted, version semantics, commands, hash, ignore | `docs/spec-lifecycle.md` new section; `extensions/project-state/README.md` (layout table, version semantics, commands, config hash); `README.md` command list | met |
| R27 | Distinguish product version, pi-config commit, Pi package version, session-format version | `collectProvenance` 4 distinct keys + `subagentModels`/`model`; `metadata.test.mjs` §7 | met |
| R28 | Preserve worker/scout/reviewer/oracle routing, no hard-coded model IDs | `index.ts:110-115` reads `settings.subagents.agentOverrides`; no model id literal in the extension | met |
| O1 | No eval/scoring/memory/dashboards/retention | absent from diff | met (absent) |
| O2 | No pricing/guessed telemetry | `metadata.mjs` has no price math | met (absent) |
| O3 | No replacement of Pi sessions/subagents/routing/labels/git/`/spec-cost` | absent from diff | met (absent) |
| O4 | No runtime-state changes in unrelated projects | `.gitignore` only; but see R16 — hooks write `.pi/` in every cwd | **partial** ✱ |

✱ Changes from the parent matrix: R5, R8, R19, R20 moved met → partial; R16, O4 moved met → partial.

Commands I could not run (no shell access): `bash tests/project-state/test.sh` — supervisor should run it.

---

### Step 2 — Findings

**(a) Missing / partial**

- **P1 — no per-agent (subagent) usage is recorded.** Spec: "Use … assistant usage entries, and available subagent artifacts only where their values are reliable"; "record Pi-provided usage/cost totals and native usage breakdowns when present"; "Keep per-agent fields extensible." Evidence: `index.ts:223-232` records only `aggregateUsage` + `subagentModels` (routing); `metadata.mjs` has no artifact reader; grep for `subagent-artifacts` in `extensions/project-state/` → 0 hits, while `skills/spec-cost/cost.py:190-215` already consumes `<session-dir>/subagent-artifacts/*_meta.json` `usage.cost` as reliable. Effect: `/session-cost` and later eval aggregation under-report precisely where review cost concentrates. Smallest fix: add a nullable `subagentUsage: [{agent, cost, runs}]` field filled from those artifacts.
- **P1 — lifecycle-boundary writes keep session-start snapshots.** Spec: "reconcile derived spec/phase/branch at startup and lifecycle boundaries, … those sources winning on divergence." Evidence: `index.ts:229-231` and `index.ts:250-256` write `currentSession.activeSpec/phase/branch` captured at `index.ts:183-185`, instead of re-deriving via `currentBranch`/`deriveActiveSpec`/`readGhSpecPhase`. After `/spec-start` creates `spec/10-…` mid-session, the finalized record and `state.json` still say `branch: development`, `activeSpec: null` — durable, wrong data in a write-once record. Smallest fix: re-derive before those two writes.
- **P2 — R16: no setup path updated.** Spec: "Update the deliberate project setup/configuration path as needed so configured projects get the rules." Only prose (`extensions/project-state/README.md:26-27`); `/spec-init` (writes `.pi/settings.json`) and `/pi-config` untouched, so other projects accumulate untracked `.pi/` (and `changedFiles()` will list their own logs).
- **P2 — R19: `getHeader()` unused.** Spec names "`ReadonlySessionManager` header/ID/path/entries". `SessionHeader.timestamp`/`cwd` are available, but `startedAt` is wall-clock (`state.mjs` `createSession` default), so resumed/reloaded sessions misstate their start.

**(b) Not asked for**

- **P2 — reload special case** (`index.ts:203-215`): an extra projection write on `session_shutdown` reason `reload` that also skips finalization. Unspecified by the spec (which only names pre-compaction projection and shutdown finalization); harmless but undocumented in the README's command/lifecycle docs.
- **P2 — `spec.versionFile` provenance source** (`index.ts:104-108`): spec says product version means "package.json/release tags"; honoring a configured version file is an extra surface (arguably fine).

**(c) Implemented but looks wrong**

- **P2 — dead projection fields.** `presentation.mjs:27` renders `pendingWork`, but nothing ever sets it (`schema.mjs:106` default; no `pendingWork` in `index.ts`), and `checkResults` (`schema.mjs:147`) likewise; spec's "pending work/checks when reliably known" is therefore never observable.
- **P2 — newer-schema `state.json` is silently downgraded.** `loadStateSafe` (`index.ts:131-137`) swallows `SchemaError`, then `session_start` immediately `writeStateAtomic`s a v1 document, so "reject unsupported/malformed documents safely" becomes overwrite. Fix: skip the write when `loadState` throws `SchemaError`.

Merge verdict: **OK with notes** — no P0; the two P1s (per-agent usage, stale boundary reconciliation) are worth fixing before release, ideally on this branch.