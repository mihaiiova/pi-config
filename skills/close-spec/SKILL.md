---
name: close-spec
description: Finish accepted work. Require a successful review, merge the spec branch into the configured base branch, push, close the spec issue, delete the branch locally and remotely, mark the spec done, and update any parent epic's progress.
---

# Close spec

Merge reviewed work, close the tracking issue, clean up the branch, and update any parent epic.

## Process

1. **Require a successful review.** The spec issue must carry `spec:reviewed` (or the review report must show no blockers). Refuse to merge otherwise and report what is still blocking.

2. **Merge into the base branch.** Check out the base branch (from `spec.baseBranch` or the default), then merge the spec branch with a merge commit: `git checkout <base> && git merge --no-ff spec/<id>-<slug>`. Push the base branch: `git push origin <base>`.

3. **Close the issue.** Close the spec issue with `gh issue close <number>`, with a comment referencing the merge commit.

4. **Delete the branch.** `git branch -d spec/<id>-<slug>` locally, then `git push origin --delete spec/<id>-<slug>`.

5. **Mark done.** Apply `spec:done` and remove `spec:reviewed` on the spec issue (create the label if needed).

6. **Update the parent epic, if any.** If the spec's body has a `## Parent` link to an epic:
   - Read the epic (its `# Child specs` / `## Child spec issues` list) to find the sibling specs.
   - For each sibling blocked by this now-closed spec, check whether *all* of its `## Blocked by` issues are closed. If so, apply `spec:ready` to that sibling (its blockers are cleared).
   - If **all** children are now done, do **not** silently close the epic. Report:

     > Epic #<n> now has all child specs complete and is ready to close.

   - Do not close the epic automatically; leave that as an explicit, separate action.

7. **Report.** The merged commit, the pushed base branch, the closed issue, the deleted branch, any siblings made ready, epic-complete status if reached, and confirm status → `done`.
