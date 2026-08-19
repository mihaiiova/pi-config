---
name: audit-codebase
description: Read-only whole-repository technical health audit. Orchestrates code-review, codebase-design, and improve-codebase-architecture primitives plus stack-specific skills, then consolidates findings into a small number of prioritized technical initiatives.
---

# Audit codebase

A read-only whole-repository technical health audit. It identifies technical work for `/new-spec` to define — it does not itself change anything.

## Boundaries

- **Read-only** — the audit **must not modify production code**, tests, or configuration. Any file you create (e.g. a report) goes to the OS temp directory, not the repo.
- Do **not** use `/review-session` as a primary input — that skill reviews how the *session/agent* worked, not codebase health.
- Do not dump hundreds of lint-like findings. Consolidate into a small number of technical initiatives.
- Do not create GitHub issues automatically; present recommendations first.

## Inputs

Orchestrate existing primitives rather than inventing a new methodology:

- `/code-review --codebase` for whole-codebase standards and Fowler code smells.
- `/codebase-design` vocabulary and principles (module, interface, depth, seam, adapter, leverage, locality; the deletion test; "the interface is the test surface").
- `/improve-codebase-architecture` as the architecture-analysis primitive (shallow modules, deepening opportunities, seam placement).
- Stack-specific best-practice skills only where the detected stack clearly applies (e.g. `react-best-practices` for a React codebase). Do not blindly run every best-practice skill in pi-config.
- Repository verification commands (tests / typecheck / lint / build / static analysis) where available, as evidence — not as a substitute for review.

## Audit dimensions

1. **Architecture** — module depth, seam quality, locality, coupling, dependency direction, scattered domain behavior, architectural drift, hard-to-test modules.
2. **Code quality** — duplication, Fowler smells (already defined in `code-review`), unclear naming, unnecessary abstractions, divergent change, shotgun surgery, inconsistent patterns.
3. **Testability** — risky behavior without tests, tests coupled to implementation details, difficult dependency injection, excessive mocking/fixture complexity, interfaces that are poor test surfaces.
4. **Maintainability** — dead/obsolete code, unused dependencies where practical, stale compatibility paths, TODO/FIXME debt, duplicate approaches to the same problem, poor discoverability/documentation where it materially affects maintenance.
5. **Stack-specific health** — only skills relevant to the detected stack.

## Output

Consolidate raw findings into a small number of technical initiatives. For each significant initiative report:

- **title**
- **severity**: high / medium / low
- **confidence**: high / medium / low
- **affected modules/files**
- **evidence**
- **why it matters**
- **recommended direction**
- **rough scope**: small / medium / large
- **existing GitHub issue**, if one already describes the same debt
- **suggested next action**

Suggested next action is usually one of:
- `/new-spec <existing issue>`
- create issue, then `/new-spec`
- fix opportunistically
- no action

Search existing open GitHub issues (`gh issue list`) before suggesting a new technical-debt issue, so the audit does not repeatedly rediscover the same work.

End the report with:

```
## Top technical recommendation

<single recommendation>

### Why this should be addressed first

<rationale>
```

Architecture refactors must not bypass the normal lifecycle: `/audit-codebase` identifies → `/new-spec` defines → `/start-spec` implements → `/review-spec` verifies → `/close-spec` integrates.
