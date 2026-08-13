---
name: define-spec
description: Define a feature or change by resolving scope, behavior, constraints, and acceptance criteria from a GitHub issue thread.
disable-model-invocation: true
---

# Define spec

This command is running non-interactively from GitHub Actions.

1. Read the complete thread at `$PI_ISSUE_THREAD_FILE`.
2. Inspect the repository and its `AGENTS.md` files for relevant constraints. Do not modify files.
3. Turn the discussion into a concise, decision-ready definition. Preserve explicit user decisions and identify genuine unresolved questions instead of inventing answers.
4. Return Markdown suitable for an issue comment with these sections when applicable:
   - Summary
   - Goals and non-goals
   - User-visible behavior
   - Constraints and edge cases
   - Acceptance criteria
   - Open questions

Do not call GitHub APIs, create issues, close issues, commit, or push. Your final response is posted back to the source issue automatically.
