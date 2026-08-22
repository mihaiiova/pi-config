---
name: new-spec
description: Understand and define a piece of work end-to-end. Inspect the repository, interview for decisions with grill-me, decide between a single cohesive spec and an epic of child specs, and publish the resulting plan to GitHub via the trusted plan applier.
---

# New spec

Turn a feature request or idea into published, decision-complete implementation work. `/new-spec` owns **definition and planning only**. The atomic implementation unit is always a **spec**. An **epic** is only a planning container for multiple independently implementable specs.

## Boundaries

`/new-spec` must not:
- edit product code
- create an implementation branch (branching belongs to `/start-spec`)
- run `/tdd`, merge anything, or close implementation specs
- create implementation tickets beneath a spec

It may inspect the codebase as deeply as needed to resolve design facts.

## Process

1. **Inspect the repository.** Read every applicable `AGENTS.md`, `CONTEXT.md` (if present), ADRs, the domain glossary, and the area the change touches. Resolve facts by exploring the codebase; never ask the user for a discoverable fact.

2. **Decide: spec or epic.** Recommend the structure as part of the interview; do not ask "should this be an epic?" merely because the request is large.

   Prefer an **epic** when the work contains multiple outcomes that can each be implemented, validated, reviewed, and meaningfully completed independently; when one outcome is a reusable foundation for later outcomes; when there are real delivery dependencies; or when incremental delivery materially lowers risk/context size.

   Prefer a **normal spec** when the work is one cohesive outcome, even if it touches several technical layers or modules. Crossing frontend/backend/database boundaries alone is not a reason for an epic. Do not create a child spec solely because a technical prerequisite exists; keep prerequisites inside the parent spec unless they have independent architectural or product value. Prefer vertical/tracer-bullet children over layer-based decomposition.

3. **Interview for decisions.** Run `/grill-me` (`grilling`): one material decision at a time, recommend an answer, and wait for the user's answer before the next. Use `/domain-modeling` where terminology or ADRs genuinely need updating. Do not publish until shared understanding is reached.

4. **Capture decisions as they settle.** They become Implementation Decisions and Testing Decisions.

5. **Synthesize specs.** Use `/to-spec`'s structure (Problem Statement, Solution, User Stories, Implementation Decisions, Testing Decisions, Release impact, Out of Scope, Further Notes), skipping its publishing step. Testing Decisions must name the public seams `/tdd` will exercise. `Release impact` is one of `major`, `minor`, `patch`, or `none`; apply SemVer semantics and record the decision for `/release`. For an epic, every child is a complete spec suitable for `/start-spec` without another broad requirements interview, and every child has its own release impact.

6. **Generate a plan identity.** Every plan has an opaque `plan_id` generated once (UUID or similarly collision-resistant identifier). Reuse the same `plan_id` when resuming/re-running the same definition. Do not derive identity from a title or slug. Artifact `id` fields remain readable stable kebab-case identifiers within that plan.

7. **Build plan JSON** in a temp file.

   Normal spec:
   ```json
   {
     "plan_id": "<opaque-id>",
     "kind": "spec",
     "spec": {
       "id": "add-csv-export",
       "title": "Spec: Add CSV export",
       "body": "<to-spec markdown>",
       "labels": []
     }
   }
   ```

   Epic:
   ```json
   {
     "plan_id": "<opaque-id>",
     "kind": "epic",
     "epic": {
       "id": "content-ingestion",
       "title": "Epic: Rework content ingestion",
       "body": "<epic markdown>",
       "labels": []
     },
     "specs": [
       {
         "id": "content-source-foundation",
         "title": "Introduce normalized content source model",
         "body": "<to-spec markdown>",
         "labels": [],
         "blocked_by": []
       },
       {
         "id": "youtube-ingestion",
         "title": "Implement YouTube ingestion",
         "body": "<to-spec markdown>",
         "labels": [],
         "blocked_by": ["content-source-foundation"]
       }
     ]
   }
   ```

   `blocked_by` is only for sibling implementation specs and is distinct from parent/child structure. List blockers before dependants.

   Epic body sections: `# Summary`, `# Goals`, `# Non-goals`, `# Architecture / implementation direction`, `# Child specs`, `# Completion criteria`.

8. **Apply the plan.** Run `scripts/spec/apply-plan.sh <plan.json>`. The trusted applier validates the plan, creates artifacts in dependency-safe order, links parent/child and blockers, manages lifecycle labels, and is **idempotent and convergent**: a rerun with the same `plan_id` and artifact id reuses the same GitHub issue and updates it to the latest title/body rather than leaving stale content. Do not create issues by hand.

9. **Report.** Summarize the created spec or epic, dependency graph, agreed testing seams, and readiness. A normal spec becomes `spec:ready`. An epic is a `spec:epic` container; unblocked children become `spec:ready` and blocked children become ready when their blockers close.

See `docs/spec-lifecycle.md` for lifecycle states, branch rules, epic completion, and resume semantics.
