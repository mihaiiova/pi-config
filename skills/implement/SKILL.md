---
name: implement
description: "Implement a piece of work based on a spec or set of tickets, including non-interactive GitHub issue runs."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

When `$PI_ISSUE_THREAD_FILE` is set, this is the GitHub Actions adapter for the appended `tdd` skill. Follow its red → green method, test quality rules, and system-boundary mocking guidance throughout the implementation.

1. Read that complete issue thread first. If it links a parent spec, fetch and read the full parent issue and comments too. Then inspect the repository and all applicable `AGENTS.md` instructions.
2. Check every issue referenced under `Blocked by`. If any blocker is still open, do not modify the worktree; return a comment listing the blockers that must close first.
3. Extract the pre-agreed public testing seams from the parent spec's Testing Decisions, or from the current issue when it is the unsplit spec. If they are missing or ambiguous, do not modify the worktree; return a comment explaining which seam decision is needed.
4. Create or reuse a branch named `pi/issue-$PI_ISSUE_NUMBER`. Never commit directly to the default branch.
5. Implement only the current ticket's agreed scope in vertical TDD slices: one failing behavioral test at an agreed seam, the minimum implementation to pass, then the next slice. Confirm each red failure is caused by the missing behavior before writing production code.
6. Run the narrowest relevant checks on every slice and the project-level verification once at the end.
7. Review the diff against both repository standards and the issue spec, commit it, push the branch, and open a pull request that references the source issue. Reuse an existing open pull request for the branch if one exists.
8. Make the final response a concise issue comment containing the pull request link, summary, the seams tested, and verification results. If implementation cannot be completed safely, do not push partial work; explain the blocker in the final response.

Use `gh` for GitHub operations. Authentication is provided at runtime through `GH_TOKEN`; never print it or persist it.

The issue spec is the user confirmation for its documented testing seams, so no interactive prompt is needed during the Actions run. Do not invent or test at undocumented seams.
