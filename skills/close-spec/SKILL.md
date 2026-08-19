---
name: close-spec
description: Finish accepted work. Require a successful review, merge the spec branch into the configured base branch, push, close the spec and ticket issues, delete the branch locally and remotely, and mark the spec done.
---

# Close spec

Merge reviewed work, close the tracking issues, and clean up the branch.

## Process

1. **Require a successful review.** The spec issue must carry `spec:reviewed` (or the review report must show no blockers). Refuse to merge otherwise and report what is still blocking.

2. **Merge into the base branch.** Check out the base branch (from `spec.baseBranch` or the default), then merge the spec branch with a merge commit: `git checkout <base> && git merge --no-ff spec/<id>-<slug>`. Push the base branch: `git push origin <base>`.

3. **Close the issues.** Close the spec issue and every ticket issue with `gh issue close <number>`, each with a comment referencing the merge commit and the spec issue.

4. **Delete the branch.** `git branch -d spec/<id>-<slug>` locally, then `git push origin --delete spec/<id>-<slug>`.

5. **Mark done.** Apply `spec:done` and remove `spec:reviewed` on the spec issue (create the label if needed).

6. **Report.** The merged commit, the pushed base branch, the closed issues, the deleted branch, and confirm status → `done`.
