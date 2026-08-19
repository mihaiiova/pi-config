---
name: start-spec
description: Begin implementing a ready spec. Refuse epic containers, present their startable children, validate readiness and blockers, sync the configured base branch, create the spec feature branch, mark it in progress, and implement with tdd.
---

# Start spec

Load a ready spec, prepare the worktree, and implement it test-first. An epic is a planning container, not something `/start-spec` implements directly.

## Process

1. **Load the issue.** Take the target by issue number, URL, or path. Read the issue body and all its comments.

2. **Refuse an epic container.** If the issue is an epic — it carries the `spec:epic` label, or its body is an epic structure (`# Summary` / `# Goals` / `# Child specs`) — do **not** implement it. Report:

   > This is an epic. Start one of its ready child specs instead.

   Then list the child specs and, taking `Blocked by` into account, which are currently startable. Stop here.

3. **Validate readiness.** The spec issue must carry `spec:ready`. If it is blocked (its body's `## Blocked by` links to issues that are still open), refuse and report the open blockers. If the testing seams in its Testing Decisions are missing or ambiguous, stop and ask for the seam decision before touching the worktree.

4. **Determine the base branch.** Read `spec.baseBranch` from `.pi/settings.json`; otherwise use the repository's default branch. Sync it: `git fetch origin`, then fast-forward the local base branch to its remote.

5. **Create the feature branch.** Branch from the synced base as `spec/<id>-<slug>`, where `<id>` is the spec issue number and `<slug>` is a short kebab-case slug from the title. Never commit directly to the base branch.

6. **Mark in progress.** Apply `spec:in-progress` and remove `spec:ready` on the spec issue (create the label if needed).

7. **Implement with `/tdd`.** Work only the spec's agreed scope in vertical slices at the pre-agreed seams: one failing behavioral test, the minimum implementation to pass it, then the next slice. Confirm each red failure is caused by the missing behavior before writing production code. Create checkpoint commits that reference the spec issue.

8. **Leave the branch unmerged.** Do not merge or push to the base branch. `/review-spec` verifies the work and `/close-spec` merges it.
