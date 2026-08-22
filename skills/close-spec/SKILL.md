---
name: close-spec
description: Finish accepted work. Merge an implementation spec into the development integration branch and close it, or explicitly close a completed epic once every child spec is done.
---

# Close spec

Finish one lifecycle artifact. For an implementation spec this means merge, close, and clean up. For an epic this means verify every child is complete and then explicitly close the container.

## Epic case

If the target carries `spec:epic`:

1. Read all child spec links from the epic.
2. Verify every child issue is closed and/or carries `spec:done`.
3. If any child is incomplete, refuse and list the remaining children.
4. If all are complete, close the epic issue, remove any non-applicable lifecycle-state labels, keep `spec:epic` as the type marker, and apply `spec:done`.
5. Report completion. There is no branch merge or deletion for an epic.

Stop after the epic case.

## Implementation spec case

1. **Require a successful review.** The spec must carry `spec:reviewed` (or an unambiguous current review report with no blockers). Refuse otherwise.

2. **Resolve the integration branch.** Read `spec.baseBranch` from `.pi/settings.json`, defaulting to `development`. Read `spec.releaseBranch` or use the repository default branch (`main` or `master`). Fetch first. If the integration branch is missing both locally and remotely, create it from the synced release branch and push it with upstream tracking. If it exists remotely, track and fast-forward it. Never reset or recreate an existing branch. Refuse if the release branch is missing, histories are ambiguous, or a local branch cannot be fast-forwarded safely.

3. **Merge into integration.** Merge the canonical `spec/<id>-<slug>` branch into the integration branch with a merge commit and push. If the spec commit is already an ancestor of integration, treat the merge as complete and resume the remaining close steps instead of merging again.

4. **Close the issue.** Close the spec issue with a comment referencing the merge commit. If the issue is already closed with an integration commit that is still on the integration branch, reuse that evidence.

5. **Delete the branch only after merge and push succeed.** Delete the local branch, then the remote branch if present. Missing branches on a resumed run are already clean, not errors.

6. **Transition to done.** A non-epic spec carries exactly one lifecycle-state label. Remove `spec:ready`, `spec:in-progress`, and `spec:reviewed`; apply `spec:done`. Reapplying the already-correct state is a no-op.

7. **Update the parent epic, if any.** If the spec has a `## Parent` link:
   - inspect sibling child specs;
   - for each sibling blocked by the newly closed spec, check whether all `## Blocked by` issues are now closed; when they are, transition that sibling to `spec:ready`;
   - if every child is now complete, report: `Epic #<n> now has all child specs complete. Run /close-spec #<n> to close the epic.`

8. **Report.** Include merge commit, pushed integration branch, closed issue, branch cleanup, siblings made ready, and any epic-complete status. Remind the user that `/release` promotes accumulated integration work to the release branch.
