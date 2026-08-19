---
name: start-spec
description: Begin implementing a ready spec. Refuse epic containers, present their startable children, validate readiness and blockers, resume or create the spec branch, mark it in progress, and implement with tdd.
---

# Start spec

Load one implementation spec, prepare or resume its worktree, and implement it test-first. An epic is a planning container, not an implementation target.

## Process

1. **Load the issue.** Take the target by issue number, URL, or path. Read the body and comments.

2. **Refuse an epic container.** If the issue carries `spec:epic` (or clearly has the epic structure), do not implement it. Report that it is an epic and list its child specs, highlighting currently startable children after checking blockers. Stop.

3. **Validate state and blockers.** A fresh spec must carry `spec:ready`. A resumed spec may carry `spec:in-progress`. If `## Blocked by` contains any still-open issue, refuse and report the blockers. If Testing Decisions do not contain a usable public testing seam, stop before touching the worktree and resolve that decision.

4. **Determine and sync the base branch.** Read `spec.baseBranch` from `.pi/settings.json`; otherwise use the repository default. `git fetch origin`, then fast-forward the local base to its remote. Never invent or silently create a missing base branch.

5. **Resume or create the feature branch.** The canonical branch is `spec/<issue-number>-<slug>`.
   - If neither local nor remote branch exists, create it from the synced base.
   - If it already exists and clearly belongs to this spec, check it out and resume it; if only remote exists, create the local tracking branch.
   - If a same-named branch exists but its history/issue references make ownership ambiguous, refuse and ask rather than overwriting it.
   - Never reset or recreate an existing spec branch just to make it match the base.

6. **Transition to in progress.** Treat lifecycle labels as a state machine: a non-epic spec carries exactly one of `spec:ready`, `spec:in-progress`, `spec:reviewed`, `spec:done`. When starting fresh, remove other lifecycle-state labels and apply `spec:in-progress`. When resuming an already `spec:in-progress` spec, leave the state unchanged.

7. **Implement with `/tdd`.** Work only the agreed scope in vertical slices at the pre-agreed seams: one failing behavioral test, minimum implementation, then the next slice. Confirm each red failure is caused by missing behavior before production changes. Create coherent checkpoint commits referencing the spec issue.

8. **Leave the branch unmerged.** Do not merge or push the base branch. `/review-spec` verifies the implementation and `/close-spec` integrates it.
