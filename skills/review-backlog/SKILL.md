---
name: review-backlog
description: Whole-project issue and backlog review. Inspect open issues, compare their claims against the current code, classify them by readiness and value, and recommend what to work on next — without mutating GitHub until approved.
---

# Review backlog

Review the whole project's open issues and recommend what to do next. Reason about **value and readiness**, not merely issue age.

## Boundaries

- **do not mutate GitHub** (no labeling, closing, editing, or commenting) until the user explicitly approves specific changes; act only after approval.
- Present recommendations first; act only after approval.

## Process

1. **Gather open issues.** List them (`gh issue list --state open`, plus `--limit` to cover the backlog). Pull the body, labels, and any comments for each.

2. **Compare each issue's claim against the current code.** For every issue, search the codebase for an existing implementation of the requested behavior — by domain concept, not just the request's wording — and report where you looked. This catches already-implemented and stale work.

3. **Classify each issue** into one of:

   - **in progress** — actively being implemented (has an open branch/PR or a `spec:in-progress`/`spec:reviewed` label)
   - **ready to start** — fully defined and unblocked (`spec:ready`, or an accepted ready-for-agent brief)
   - **needs definition** — insufficient scope/acceptance criteria; needs `/new-spec`
   - **blocked** — depends on other still-open work, or is an epic child whose blockers aren't done
   - **duplicate** — same work already tracked elsewhere
   - **likely obsolete** — already implemented, or no longer relevant
   - **undefined/epic** — a planning container (e.g. `spec:epic`), not directly startable

4. **Understand dependencies.** For each issue, note its `## Blocked by` links and its parent epic (`## Parent`). Distinguish parent/child from blocker/dependency.

5. **Recommend.** Produce:

   - **in progress**
   - **ready to start**
   - **needs definition**
   - **blocked**
   - **duplicates**
   - **likely obsolete**
   - **recommended next plan** — what to pick up next, and why (value × readiness), including which epic children are currently startable.

6. **Recommend cleanup.** For duplicates and likely-obsolete issues, propose the specific actions (close, relabel, merge) but wait for approval before applying them.

## Relationship to the lifecycle

`/review-backlog` answers *what product/project work should we do?* It feeds `/new-spec`, which defines the chosen work. Issues that are `needs definition` are candidates for `/new-spec`; `ready to start` candidates go straight to `/start-spec`; `blocked` children become startable as their blockers close via `/close-spec`.
