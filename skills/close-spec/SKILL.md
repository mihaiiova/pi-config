---
name: close-spec
description: Finish accepted work. Merge and close an implementation spec, or explicitly close a completed epic once every child spec is done.
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

2. **Merge into the configured base.** Resolve `spec.baseBranch` from `.pi/settings.json` or the repository default. Check it exists; never create a missing base branch implicitly. Check out and fast-forward it, then merge the canonical `spec/<id>-<slug>` branch with a merge commit and push the base branch.

3. **Close the issue.** Close the spec issue with a comment referencing the merge commit.

4. **Delete the branch only after merge and push succeed.** Delete the local branch, then the remote branch if present.

5. **Transition to done.** A non-epic spec carries exactly one lifecycle-state label. Remove `spec:ready`, `spec:in-progress`, and `spec:reviewed`; apply `spec:done`.

6. **Update the parent epic, if any.** If the spec has a `## Parent` link:
   - inspect sibling child specs;
   - for each sibling blocked by the newly closed spec, check whether all `## Blocked by` issues are now closed; when they are, transition that sibling to `spec:ready`;
   - if every child is now complete, report: `Epic #<n> now has all child specs complete. Run /close-spec #<n> to close the epic.`

7. **Report.** Include merge commit, pushed base branch, closed issue, branch cleanup, siblings made ready, and any epic-complete status.
