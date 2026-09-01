---
name: workflow
description: Quick recap of the main pi-config skills — the spec lifecycle (/spec-new, /spec-start, /spec-review, /spec-close) and the discovery skills (/spec-backlog, /spec-audit).
---

# Workflow

## Discovery

- `/spec-backlog` — review open issues against the code; recommend what product/project work to do next.
- `/spec-audit` — read-only technical-health audit; consolidates findings into prioritized technical initiatives.

## Spec lifecycle

- `/spec-new` — define a normal spec or an epic of child specs; publish via the trusted plan applier.
- `/spec-start` — implement one spec with TDD (refuses epic containers).
- `/spec-review` — verify one implementation (tests, code-review, acceptance criteria).
- `/spec-close` — merge, close, clean up; updates parent-epic progress.

See `docs/spec-lifecycle.md` for status labels, parent/child + blocker relationships, and branch naming.
