---
name: review-backlog
description: Whole-project work-queue review. Inspect open issues across product and technical work, compare claims against current code where useful, classify readiness and value, and recommend what to do next without mutating GitHub until approved.
---

# Review backlog

Review the project's entire open work queue and recommend what to do next. This is the final prioritization layer across product work, technical debt, ideas, and specs. Reason about **value × readiness**, not age alone.

## Boundaries

- Do not mutate GitHub until the user explicitly approves specific changes.
- Present recommendations first.
- Do not deep-audit every issue unnecessarily; use a staged pass so the command remains cheap enough to run frequently.

## Process

1. **Cheap inventory pass.** List all open issues with title, labels, age, body summary, known parent/blocker links, and PR/branch activity where practical. Recognize `idea`, `spec:epic`, `spec:ready`, `spec:in-progress`, `spec:reviewed`, and ordinary unstructured issues.

2. **Identify items that need deep verification.** Deep-check the codebase only for issues that are plausible next-work candidates, suspiciously stale, likely duplicates/already implemented, ambiguous in state, or otherwise material to the recommendation. Do not search the entire codebase separately for every low-value issue.

3. **Verify selected claims against current code.** Search by domain concept, not only issue wording. Record where you looked. Use this to detect already-implemented, partially implemented, or architecture-changed work.

4. **Classify each issue** into one primary bucket: in progress, ready to start, needs definition, blocked, duplicate, likely obsolete, or epic.

5. **Understand dependencies.** Distinguish parent/child structure from blocker/dependency. Highlight which epic children are currently startable.

6. **Recommend the next plan.** Prioritize across all known work, including technical initiatives previously surfaced by `/audit-codebase`. Explain why the top item wins on value, readiness, unblock leverage, risk, and scope. Avoid fake numeric precision.

7. **Recommend cleanup.** For duplicates and obsolete issues, propose exact close/merge/relabel actions but wait for approval.

## Relationship to other skills

- `/new-idea` captures shallow thoughts for later.
- `/audit-codebase` discovers technical problems not yet represented in the work queue.
- `/review-backlog` decides priority across the resulting full queue.
- `needs definition` → `/new-spec`.
- `ready to start` → `/start-spec`.
