---
name: create-spec
description: Convert an agreed GitHub issue definition into small, independently actionable implementation issues.
disable-model-invocation: true
---

# Create spec

This command is running non-interactively from GitHub Actions.

1. Read the complete thread at `$PI_ISSUE_THREAD_FILE` and inspect the repository plus relevant `AGENTS.md` files.
2. Treat settled decisions in the thread as authoritative. If a material product decision remains unresolved, do not guess. Write the blocked form described below so the issue receives a clear comment and stays open.
3. Split the work into the smallest useful set of ordered, independently actionable issues. Include context, scope, implementation guidance, acceptance criteria, dependencies, and verification in every issue body.
4. Write only valid JSON to `$PI_CREATE_SPEC_PLAN` using this exact shape:

```json
{
  "issues": [
    {
      "title": "Short imperative title",
      "body": "Markdown issue body",
      "labels": []
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

Use only labels already present on the source issue unless the thread explicitly requests another existing label. Do not invoke `gh`, create or close issues yourself, modify project files, commit, or push. The workflow validates the plan, creates every child issue, links them to the definition, and closes the definition only after all creations succeed.

Your final response may briefly summarize the planned split; it is not used to perform GitHub mutations.
