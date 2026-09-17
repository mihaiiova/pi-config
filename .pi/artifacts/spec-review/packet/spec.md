# Spec #10: Add project state and append-only session history

> Source: GitHub issue #10 (repo mihaiiova/pi-config), label `spec:in-progress`.

## Problem Statement

Pi-config has no project-local, durable resume context or concise historical record of sessions. Pi session JSONL and subagent artifacts already contain some usage data, but they are stored in Pi's global agent directory and are not a stable project-level inspection surface. Existing spec lifecycle state remains authoritative in GitHub labels, while git remains authoritative for branch state.

The project needs a small local foundation that can resume workflow context, explain completed sessions, retain only reliably observable cost/model/config/version metadata, and later serve as raw input to evaluation aggregation—without building evals or a general-purpose memory system.

## Solution

Add a focused `extensions/project-state/` extension with separate schema/type, persistence, lifecycle, metadata, and presentation modules. It will maintain a mutable `.pi/state.json` resume projection and immutable `.pi/sessions/<filesystem-safe-session-id>.json` records. Project configuration remains `.pi/settings.json` and `.pi/pi-config.json`; runtime state/logs are ignored by git by default.

Use Pi's native extension lifecycle and session APIs rather than a replacement lifecycle: initialize/load state and an in-memory session record on `session_start`; record observable updates during the session; write a finalized session record on `session_shutdown`; persist a minimal projection before compaction if an appropriate native compaction event is exposed. Use Pi session manager/header/model/context-usage APIs, assistant usage entries, and available subagent artifacts only where their values are reliable. Omit/null unavailable facts; do not infer telemetry or manually price models.

`state.json` is explicitly non-authoritative. GitHub lifecycle labels and git are reconciled at session/lifecycle boundaries and win on divergence. State contains only current active spec, lifecycle phase, branch, last session ID, pending work/checks when reliably known, update time, and `schemaVersion`.

Final session records are write-once. Their filename ID is stable and filesystem-safe; finalization must never overwrite an existing final record. Each record has `schemaVersion`, timestamps, resolved project context where available, concise summary/outcome when reliably available, changed files/check results when known, agent/skill/model usage where observable, and version/config provenance. Provenance includes pi-config commit SHA, installed Pi version, effective parent/subagent models and thinking levels where available, and a stable hash/reference for active configuration rather than copying large configuration. Product `package.json` version and Pi session-format version are represented distinctly when available.

Register concise read-only commands: `/session-status` (current projection, branch/spec/phase/pending/current-session cost if known), `/session-history` (recent date/summary/spec/outcome/cost), and `/session-cost` (current plus limited recent/project aggregate known cost). Keep `/spec-cost` intact; expose documented, stable session-record fields so it can aggregate these logs later without duplicating its current parsing work.

## Implementation Decisions

- **Structure:** one cohesive normal spec, not an epic.
- **State authority (user decision):** `.pi/state.json` is a projection/cache. GitHub issue lifecycle labels and git are authoritative; reconcile derived spec/phase/branch at startup and lifecycle boundaries, with those sources winning on divergence.
- **Storage (auto-decided):** use project-local `.pi/state.json` and `.pi/sessions/`; retain `.pi/settings.json` and `.pi/pi-config.json` as configuration.
- **Git behavior (auto-decided):** add targeted ignore rules for `.pi/state.json` and `.pi/sessions/` so mutable runtime data stays local; do not ignore existing version-controlled `.pi` configuration or alter unrelated repositories. Update the deliberate project setup/configuration path as needed so configured projects get the rules.
- **Separate concepts (auto-decided):** schemas/types, mutable atomic state persistence, append-only session persistence/finalization, Pi lifecycle integration, version collection, and command rendering are distinct modules under `extensions/project-state/`.
- **Schema and migration (auto-decided):** every persisted state/session document starts with `schemaVersion: 1`; loaders dispatch through explicit migration/version handling and reject unsupported/malformed documents safely. Keep state small and do not duplicate cheaply derived git/settings/label data.
- **Append-only behavior (auto-decided):** write final records with exclusive/create-once semantics and safe temporary-file/rename behavior where practical; an existing final ID is an error/no-op, never an update.
- **Native APIs (auto-decided):** use ExtensionAPI lifecycle events (`session_start`, `session_shutdown`, appropriate compaction-related lifecycle if supported), `ReadonlySessionManager` header/ID/path/entries, model/context usage, and Pi assistant/subagent usage artifacts only for facts actually exposed.
- **Telemetry (auto-decided):** record Pi-provided usage/cost totals and native usage breakdowns when present. Do not calculate pricing; omit or set `null` for unavailable fields. Keep per-agent fields extensible.
- **Lifecycle compatibility (auto-decided):** do not modify `apply-plan.sh` issue-marker semantics or replace `/spec-start`, `/spec-review`, `/spec-close`, `/spec-release`, `/spec-status`, or `/spec-cost`. Integrate/reconcile around their existing label model.
- **Inspection UX (auto-decided):** provide the three concise commands in the new extension, read from project-local data, and do not make `/spec-status` write state.

## Testing Decisions

Use the repository's Node `node:assert/strict` temporary-directory test convention and wire the new suite into its area test runner. `/tdd` exercises the public persistence seam in `extensions/project-state/state.mjs`: `loadState`, `writeStateAtomic`, `createSession`, `finalizeSession`, and the schema/migration dispatcher exported from `extensions/project-state/schema.mjs`.

Tests must cover: initial/missing `.pi` creation; state read/write and `schemaVersion`; atomic serialization stability; malformed and unsupported-version files; future migration dispatch; session creation/finalization; final-record no-overwrite immutability; multiple sessions; unavailable version metadata fields; isolated temporary filesystem behavior. Command/lifecycle integration tests must assert registration and safe behavior using Pi-compatible test doubles or the repository's extension-source test convention.

## Out of Scope

- Evaluation, scoring, continuous learning, LLM-generated memory, dashboards, analytics UI, retention policy controls, or dozens of configuration switches.
- Manual model-pricing calculations or guessed token/cost/agent telemetry.
- Replacing Pi sessions, Pi subagents, existing model-tier routing, GitHub lifecycle labels, git branch state, or `/spec-cost`.
- Runtime-state changes in unrelated projects.

## Further Notes

Clarify documentation that local state/session records are runtime observability/resume data, not planning artifacts or lifecycle authority. Document file locations, persisted versus deliberately unpersisted data, version semantics, commands, config-hash/reference approach, and ignore behavior.

The implementation must distinguish product version (`package.json`/release tags), pi-config git commit, installed Pi package version, and Pi session-format version. It should preserve current `worker`, `scout`, `reviewer`, and `oracle` routing rather than hard-coding model IDs.
