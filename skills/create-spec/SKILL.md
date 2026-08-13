---
name: create-spec
description: Convert an agreed GitHub issue definition into small, independently actionable implementation issues.
disable-model-invocation: true
---

# Create spec

This is the GitHub Actions adapter for the appended `to-spec` skill. Follow its synthesis method and spec template; the rules below replace only its interactive confirmation and direct issue-tracker publishing steps.

1. Read the complete thread at `$PI_ISSUE_THREAD_FILE` and inspect the repository plus relevant `AGENTS.md` files.
2. Treat the completed `define-spec` interview and its settled decisions as authoritative. Do not interview again. If a material decision or testing seam remains unresolved, write the blocked form described below so the definition receives a clear comment and stays open.
3. Produce one complete spec using the exact `to-spec` sections: Problem Statement, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope, and Further Notes. Testing Decisions must name the pre-agreed public seams that `tdd` will exercise during implementation.
4. Write only valid JSON to `$PI_CREATE_SPEC_PLAN` using this exact shape. The array must contain exactly one issue:

```json
{
  "issues": [
    {
      "title": "Spec: concise feature name",
      "body": "Complete to-spec Markdown document",
      "labels": ["ready-for-agent"]
    }
  ]
}
```

If blocked, write this alternative instead:

```json
{
  "issues": [],
  "blocked": "Markdown explanation of the unresolved decisions and what is needed next."
}
```

Use `ready-for-agent` when that triage label exists. If the thread shows a different project-specific ready label, use that instead. If no ready label is known, use an empty list rather than inventing one. Do not invoke `gh`, create or close issues yourself, modify project files, commit, or push. The workflow validates the plan, creates and links the spec issue, and closes the definition only after creation succeeds.

Your final response may briefly summarize the spec; it is not used to perform GitHub mutations.
