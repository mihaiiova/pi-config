---
name: implement
description: "Implement a piece of work based on a spec or set of tickets, including non-interactive GitHub issue runs."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

When `$PI_ISSUE_THREAD_FILE` is set, this is the GitHub Actions adapter for the appended `tdd` and `code-review` skills. Implement with the TDD method first, then run the two-axis review before anything is pushed.

1. Read that complete issue thread first. If it links a parent spec, fetch and read the full parent issue and comments too. Then inspect the repository and all applicable `AGENTS.md` instructions.
2. Check every issue referenced under `Blocked by`. If any blocker is still open, do not modify the worktree; return a comment listing the blockers that must close first.
3. Extract the pre-agreed public testing seams from the parent spec's Testing Decisions, or from the current issue when it is the unsplit spec. If they are missing or ambiguous, do not modify the worktree; return a comment explaining which seam decision is needed.
4. Create or reuse the branch named by `$PI_BRANCH_PREFIX$PI_ISSUE_NUMBER`. Never commit directly to the default branch.
5. Implement only the current ticket's agreed scope in vertical TDD slices: one failing behavioral test at an agreed seam, the minimum implementation to pass, then the next slice. Confirm each red failure is caused by the missing behavior before writing production code.
6. Run the narrowest relevant checks on every slice. After implementation, run `$PI_VERIFICATION_COMMAND` exactly when it is non-empty; otherwise discover and run the repository's project-level verification.
7. Review the working tree, then create a local checkpoint commit that references issue `#$PI_ISSUE_NUMBER`. Do not push it yet. If the requested behavior was already present and there is no diff, skip the remaining review/publish steps and report that outcome.
8. Run the appended `code-review` skill with `$PI_REVIEW_BASE` as its fixed point. The parent spec/current issue is the spec source, so do not ask for either input. Review both axes:
   - Standards: repository instructions and the skill's smell baseline
   - Spec: completeness, correctness, and scope against the agreed issue
9. Fix every documented-standard violation and spec gap. Evaluate heuristic smell findings carefully and fix them when doing so improves the change without expanding scope. Rerun the affected checks and the same project-level verification from step 6. Amend the checkpoint or add a final review-fix commit.
10. Push only the reviewed branch, then open a pull request that references the source issue. Reuse an existing open pull request for the branch if one exists.
11. Make the final response a concise issue comment containing the pull request link, summary, the seams tested, review outcome, and verification results. If implementation or review cannot be completed safely, do not push partial work; explain the blocker in the final response.

Use `gh` for GitHub operations. Authentication is provided at runtime through `GH_TOKEN`; never print it or persist it.

The issue spec is the user confirmation for its documented testing seams, so no interactive prompt is needed during the Actions run. Do not invent or test at undocumented seams.
