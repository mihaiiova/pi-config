---
name: audit-codebase
description: Read-only whole-repository technical health audit. Orchestrates code-review, codebase-design, improve-codebase-architecture, and relevant stack-specific skills, then consolidates findings into prioritized technical initiatives.
---

# Audit codebase

A read-only whole-repository technical health audit. It discovers technical problems that may not yet exist in the backlog. `/review-backlog` remains the final prioritization layer across product and technical work.

## Boundaries

- Read-only: do not modify production code, tests, or configuration. Temporary reports go outside the repo.
- Do not use `/review-session` as a primary code-health input.
- Do not create GitHub issues automatically.
- Do not emit a lint dump. Surface only findings that imply a meaningful engineering decision or work item.

A finding should normally meet at least one threshold:
- material correctness/reliability risk;
- repeated/systemic pattern;
- significant maintenance or development friction;
- meaningful architectural leverage;
- important testability gap.

## Inputs

Orchestrate existing primitives:
- `/code-review --codebase` for repository standards and Fowler smells;
- `/codebase-design` vocabulary and principles;
- `/improve-codebase-architecture` as architecture analysis;
- stack-specific skills only when the detected stack clearly applies;
- tests/typecheck/lint/build/static analysis as evidence where practical.

## Audit dimensions

1. **Architecture** — module depth, seam quality, locality, coupling, dependency direction, scattered domain behavior, architectural drift, hard-to-test modules.
2. **Code quality** — duplication, meaningful Fowler smells, unclear naming, unnecessary abstractions, divergent change, shotgun surgery, inconsistent patterns.
3. **Testability** — risky behavior without tests, implementation-coupled tests, poor dependency injection, excessive mocks/fixtures, weak interface test surfaces.
4. **Maintainability** — dead/obsolete code, unused dependencies where practical, stale compatibility paths, TODO/FIXME debt, duplicate approaches, materially poor discoverability/documentation.
5. **Stack-specific health** — only relevant stack guidance.

## Architecture intent vs reality

Make architectural drift a first-class check:

1. Read ADRs, architecture docs, `CONTEXT.md`, and applicable `AGENTS.md` to establish the architecture the repository says it has.
2. Inspect the code to establish the architecture it actually has.
3. Surface meaningful divergences with evidence, especially newer paths that bypass agreed seams, duplicate an established module, or contradict a still-active ADR.
4. Do not re-litigate an ADR merely because another design is possible; flag it only when the current code has drifted or the recorded decision is causing concrete friction.

## Output

Consolidate raw findings into a small number of technical initiatives. For each significant initiative report:
- title
- severity: high / medium / low
- confidence: high / medium / low
- affected modules/files
- evidence
- why it matters
- recommended direction
- rough scope: small / medium / large
- existing GitHub issue, if one already describes the same debt
- suggested next action

Before suggesting a new issue, search existing open issues for the same technical work. Suggested next action is usually one of:
- `/new-spec <existing issue>`
- `/new-idea <summary>` when the finding is worth recording but not ready to define
- create an issue, then `/new-spec`
- fix opportunistically
- no action

End with a single **Top technical recommendation** and why it has the strongest technical leverage. Make clear that `/review-backlog` may still prioritize other known work ahead of it.

Architecture changes follow the normal lifecycle: `/audit-codebase` discovers → `/new-spec` defines → `/start-spec` implements → `/review-spec` verifies → `/close-spec` integrates.
