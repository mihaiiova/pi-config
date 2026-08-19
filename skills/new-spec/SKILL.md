---
name: new-spec
description: Understand and define a piece of work end-to-end. Inspect the repository, interview for decisions with grill-me, decide between a single cohesive spec and an epic of child specs, and publish the resulting plan to GitHub via the trusted plan applier.
---

# New spec

Turn a feature request or idea into published, decision-complete implementation work. `/new-spec` owns **definition and planning only** — it decides whether the request is a single spec or an epic of child specs, captures the agreed scope, and leaves the resulting issues ready to start.

## Boundaries

`/new-spec` must not:
- edit product code
- create an implementation branch (branching belongs to `/start-spec`)
- run `/tdd`, merge anything, or close implementation specs

It may inspect the codebase as deeply as needed to resolve design facts.

## Process

1. **Inspect the repository.** Read every applicable `AGENTS.md`, `CONTEXT.md` (if present), ADRs, the domain glossary, and the area the change touches. Resolve *facts* by exploring the codebase — never ask the user for a discoverable fact.

2. **Decide: spec or epic.** Apply the decision rules below and recommend a structure. Do not ask "should this be an epic?" merely because the request is large — inspect the design and recommend the correct structure, then confirm it with the user as part of the interview.

   **Prefer an epic** when one or more of these hold:
   - multiple independently shippable outcomes
   - implementation naturally crosses separate subsystems/modules
   - one part creates a foundation required by later work
   - meaningful dependency relationships between parts
   - the full implementation would create an excessively large context/diff
   - delivery can and should happen incrementally
   - each child can carry useful acceptance criteria and be reviewed independently

   **Prefer a normal spec** when the work is strongly cohesive and splitting it would create arbitrary or tightly coupled child issues. Do not split merely by technical layer (database / backend / frontend / tests) unless those are genuinely independent outcomes. Prefer vertical, tracer-bullet child specs.

3. **Interview for decisions.** Run `/grill-me` (the `grilling` skill): one decision at a time, walk the design tree, recommend an answer for each, and wait for the user's answer before the next. Use `/domain-modeling` to sharpen terminology and update `CONTEXT.md`/ADRs as decisions land. Do not enact anything until shared understanding is reached.

4. **Capture decisions as they settle.** Keep a running list; they become each spec's Implementation Decisions and Testing Decisions.

5. **Synthesize each spec.** Use `/to-spec`'s template to draft each spec body (Problem Statement, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope, Further Notes) — skip its publish step; `apply-plan.sh` owns publishing. Testing Decisions must name the pre-agreed public seams `/tdd` will exercise. For an epic, each child is a full, high-quality spec — not a vague "backend changes" stub. If a material decision remains unresolved, keep the parent definition blocked rather than publishing a fake-ready hierarchy.

6. **Use tickets only when they genuinely help.** For a *normal* spec, apply `/to-tickets`'s breakdown method to identify vertical slices (skip its publish step) when the work has independently grabbable slices — never a redundant one-ticket wrapper. Epics use child specs, not tickets.

7. **Build the plan JSON.** Write one of the two shapes below to a file (e.g. `$TMPDIR/spec-plan-<slug>.json`). Every `id` is a stable kebab-case slug you generate — it never encodes a GitHub issue number.

   Normal spec:
   ```json
   {
     "kind": "spec",
     "spec": { "id": "add-csv-export", "title": "Spec: Add CSV export", "body": "<to-spec markdown>", "labels": [] },
     "tickets": [ { "id": "kebab", "title": "...", "body": "...", "labels": [], "blocked_by": [] } ]
   }
   ```

   Epic:
   ```json
   {
     "kind": "epic",
     "epic": { "id": "content-ingestion", "title": "Epic: Rework content ingestion", "body": "<epic markdown>", "labels": [] },
     "specs": [
       { "id": "content-source-foundation", "title": "Introduce normalized content source model", "body": "...", "labels": [], "blocked_by": [] },
       { "id": "youtube-ingestion", "title": "Implement YouTube ingestion", "body": "...", "labels": [], "blocked_by": ["content-source-foundation"] }
     ]
   }
   ```

   - `blocked_by` references sibling ids (child specs) or ticket ids, listed in dependency order — blockers before dependants.
   - An epic body uses: `# Summary`, `# Goals`, `# Non-goals`, `# Architecture / implementation direction`, `# Child specs` (outcome + rationale + dependency info, by stable id), `# Completion criteria`.

8. **Apply the plan.** Run `scripts/spec/apply-plan.sh <plan.json>` (repo-inferred from `git remote -v`; `gh` authenticated). The trusted applier validates the plan, creates issues in dependency-safe order, links parent ↔ child and blockers, applies status labels, and is idempotent on rerun. Do not create issues by hand — let the applier own ordering, linking, and resumability.

9. **Report.** Summarize the created spec (or epic + child specs), the dependency graph, the agreed testing seams, and confirm readiness. For a normal spec, status → `ready`. For an epic, the epic is a container (`spec:epic`); unblocked children are `spec:ready`, blocked children become ready as their blockers close.

See `docs/spec-lifecycle.md` for the status-label vocabulary, base-branch configuration, branch naming, and the epic lifecycle.
