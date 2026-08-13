---
name: create-spec
description: Convert an agreed GitHub issue definition into small, independently actionable implementation issues.
disable-model-invocation: true
---

# Create spec

This is the GitHub Actions adapter for the appended `to-spec` and `to-tickets` skills. Use `to-spec` to synthesize the agreed design, then use `to-tickets` only when the spec needs multiple independently grabbable implementation slices. The rules below replace their interactive confirmation and direct issue-tracker publishing steps.

1. Read the complete thread at `$PI_ISSUE_THREAD_FILE` and inspect the repository plus relevant `AGENTS.md` files.
2. Treat the completed `define-spec` interview and its settled decisions as authoritative. Do not interview again. If a material decision or testing seam remains unresolved, write the blocked form described below so the definition receives a clear comment and stays open.
3. Produce one complete spec using the exact `to-spec` sections: Problem Statement, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope, and Further Notes. Testing Decisions must name the pre-agreed public seams that `tdd` will exercise during implementation.
4. Apply `to-tickets` to the completed spec:
   - Keep `tickets` empty when the spec is one cohesive implementation task.
   - Create at least two tickets when independent tracer-bullet slices or context-size limits justify a split. Never create a redundant one-ticket wrapper around the spec.
   - Order blockers before dependants and express dependencies through stable ticket IDs.
5. Return only valid JSON as your final response, with no Markdown fence or commentary, using this exact shape:

```json
{
  "spec": {
    "title": "Spec: concise feature name",
    "body": "Complete to-spec Markdown document",
    "labels": ["ready-for-agent"]
  },
  "tickets": [
    {
      "id": "stable-kebab-case-id",
      "title": "Narrow end-to-end outcome",
      "body": "## What to build\n\n...\n\n## Acceptance criteria\n\n- [ ] ...",
      "labels": ["ready-for-agent"],
      "blocked_by": []
    }
  ]
}
```

If blocked, write this alternative instead:

```json
{
  "blocked": "Markdown explanation of the unresolved decisions and what is needed next."
}
```

Use `ready-for-agent` when that triage label exists. If the thread shows a different project-specific ready label, use that instead. If no ready label is known, use an empty list rather than inventing one. When tickets are present, omit the ready label from the parent spec and apply it to each ticket; when tickets are empty, apply it to the spec itself.

Do not invoke `gh`, create or close issues yourself, modify project files, commit, or push. The trusted workflow captures your final JSON as the plan, validates it, creates the spec first, creates tickets in dependency order with real parent and blocker links, and closes the definition only after every creation succeeds.

Do not summarize outside the JSON. The workflow posts the resulting issue links back to the definition.
