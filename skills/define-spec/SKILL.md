---
name: define-spec
description: Define a feature or change by resolving scope, behavior, constraints, and acceptance criteria from a GitHub issue thread.
disable-model-invocation: true
---

# Define spec

This is the GitHub Actions adapter for the appended `grill-me` and `grilling` skills. Use their relentless, decision-by-decision interview method; the rules below only adapt that method to an asynchronous issue thread.

1. Read the complete thread at `$PI_ISSUE_THREAD_FILE`.
2. Inspect the repository and its `AGENTS.md` files for relevant constraints. Do not modify files.
3. Resolve facts by inspecting the codebase. Never ask the user for discoverable facts.
4. Build the design decision tree and determine the single highest-leverage unresolved decision.
5. If a decision remains, make the first line exactly `<!-- pi:define-spec status=question -->`, then return exactly one focused question plus your recommended answer and brief reasoning. Tell the user that replying normally will continue the interview. Do not emit a provisional definition.
6. If no material decision remains, make the first line exactly `<!-- pi:define-spec status=complete -->`, say that shared understanding has been reached, and return a concise, decision-ready definition. Preserve every explicit decision and use these sections when applicable:
   - Summary
   - Goals and non-goals
   - User-visible behavior
   - Constraints and edge cases
   - Testing seams
   - Acceptance criteria

Do not call GitHub APIs, create issues, close issues, commit, or push. Your final response is posted back to the source issue automatically.
