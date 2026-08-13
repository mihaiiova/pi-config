---
name: implement
description: "Implement a piece of work based on a spec or set of tickets, including non-interactive GitHub issue runs."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

When `$PI_ISSUE_THREAD_FILE` is set, this is a non-interactive GitHub Actions run:

1. Read that complete issue thread first, then inspect the repository and all applicable `AGENTS.md` instructions.
2. Create or reuse a branch named `pi/issue-$PI_ISSUE_NUMBER`. Never commit directly to the default branch.
3. Implement only the agreed scope. Preserve unrelated working-tree changes.
4. Run the narrowest relevant checks regularly and the project-level verification once at the end.
5. Review the diff, commit it, push the branch, and open a pull request that references the source issue. Reuse an existing open pull request for the branch if one exists.
6. Make the final response a concise issue comment containing the pull request link, summary, and verification results. If implementation cannot be completed safely, do not push partial work; explain the blocker in the final response.

Use `gh` for GitHub operations. Authentication is provided at runtime through `GH_TOKEN`; never print it or persist it.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

Commit your work to the current branch.
