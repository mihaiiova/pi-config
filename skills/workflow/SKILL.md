---
name: workflow
description: Quick recap of the main pi-config skills — the spec lifecycle (/new-spec, /start-spec, /review-spec, /close-spec) and the discovery skills (/review-backlog, /audit-codebase).
---

# Workflow

## Discovery

- `/review-backlog` — review open issues against the code; recommend what product/project work to do next.
- `/audit-codebase` — read-only technical-health audit; consolidates findings into prioritized technical initiatives.

## Spec lifecycle

- `/new-spec` — define a normal spec or an epic of child specs; publish via the trusted plan applier.
- `/start-spec` — implement one spec with TDD (refuses epic containers).
- `/review-spec` — verify one implementation (tests, code-review, acceptance criteria).
- `/close-spec` — merge, close, clean up; updates parent-epic progress.

See `docs/spec-lifecycle.md` for status labels, parent/child + blocker relationships, and branch naming.
