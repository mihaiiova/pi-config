---
name: start-spec
description: Begin implementing a ready spec. Load the spec, validate readiness, sync the configured base branch, create the spec feature branch, mark it in progress, and implement with tdd.
---

# Start spec

Load a ready spec, prepare the worktree, and implement it test-first.

## Process

1. **Load the spec.** Take the spec by issue number, URL, or path. Read the spec body and all its comments; if the spec links tickets, read those too. Identify the parent spec's pre-agreed testing seams in its Testing Decisions.

2. **Validate readiness.** The spec issue must carry `spec:ready` (or be otherwise explicitly confirmed ready). If any ticket is blocked by a still-open ticket, refuse and report the blockers. If the seams are missing or ambiguous, stop and ask for the seam decision before touching the worktree.

3. **Determine the base branch.** Read `spec.baseBranch` from `.pi/settings.json`; otherwise use the repository's default branch. Sync it: `git fetch origin`, then fast-forward the local base branch to its remote.

4. **Create the feature branch.** Branch from the synced base as `spec/<id>-<slug>`, where `<id>` is the spec issue number and `<slug>` is a short kebab-case slug from the title. Never commit directly to the base branch.

5. **Mark in progress.** Apply `spec:in-progress` and remove `spec:ready` on the spec issue (create the label if needed).

6. **Implement with `/tdd`.** Work only the spec's agreed scope in vertical slices at the pre-agreed seams: one failing behavioral test, the minimum implementation to pass it, then the next slice. Confirm each red failure is caused by the missing behavior before writing production code. Create checkpoint commits that reference the spec issue.

7. **Leave the branch unmerged.** Do not merge or push to the base branch. `/review-spec` verifies the work and `/close-spec` merges it.
