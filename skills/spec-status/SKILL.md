---
name: spec-status
description: Show the current spec-lifecycle state for a repository — branches and their drift, open specs grouped by lifecycle state, the blocker chain, and what is releasable. Read-only orientation dashboard.
---

# Spec status

A read-only orientation dashboard for the spec lifecycle. Use it at the start of a session, or when the user asks "where are we".

## Boundaries

- Read-only: no branch operations, no issue mutations, no config writes.
- Cheap: run only read commands; do not deep-scan the codebase.

## Process

1. **Branches.** Resolve `spec.baseBranch` (default `development`) and `spec.releaseBranch` (default `main`) from `.pi/settings.json`, falling back to the repository default. Report the current branch and the development ↔ production drift with `git rev-list --left-right --count <production>...<development>`.

2. **Open specs.** List open issues by lifecycle label — `spec:epic`, `spec:ready`, `spec:in-progress`, `spec:reviewed` — via `gh issue list`, grouped under each state.

3. **Blockers.** For each `spec:in-progress` or `spec:ready` spec, surface any `## Blocked by` links still open, and the in-progress spec's branch (`spec/<id>-<slug>`).

4. **Releasable work.** Compute `git log --oneline <production>..<development>` and list shipped `spec:done` issues since the last tag. State whether `/spec-release` would currently proceed or refuse ("nothing to release").

5. **Summarize.** One short block: current branch, development ↔ production drift, counts by lifecycle state, the top blocker, and releasability.

## Relationship to other skills

`/spec-backlog` prioritizes the work queue; `/spec-status` shows live execution state. `/spec-release` consumes the "releasable" result. `/spec-init` creates the `.pi/settings.json` this command reads.
