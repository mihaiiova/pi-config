---
name: new-spec
description: Understand and define a piece of work end-to-end. Inspect the repository, interview for decisions with grill-me, capture them in a spec, split into tasks when useful with to-tasks, publish the spec and tasks to GitHub, and mark the spec ready.
---

# New spec

Turn a feature request or idea into a published, decision-complete spec — and, when the work warrants it, dependency-aware tasks — marked ready for implementation.

## Process

1. **Inspect the repository.** Read every applicable `AGENTS.md`, `CONTEXT.md` (if present), ADRs, the domain glossary, and the area the change touches. Resolve *facts* by exploring the codebase — never ask the user for a discoverable fact.

2. **Interview for decisions.** Run `/grill-me` (the `grilling` skill): ask one decision at a time, walk the design tree resolving dependencies between decisions, recommend an answer for each, and wait for the user's answer before the next. Do not enact anything until shared understanding is reached.

3. **Capture every decision as it is settled.** Keep a running list of settled decisions. They become the spec's Implementation Decisions and Testing Decisions.

4. **Synthesize the spec.** Use `/to-spec` to turn the agreed understanding into the standard spec document: Problem Statement, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope, Further Notes. Testing Decisions must name the pre-agreed public seams that `/tdd` will exercise during implementation — prefer existing seams, at the highest point possible.

5. **Split into tasks when it helps.** Use `/to-tasks` only when the spec is too large for a single context window or has independently grabbable vertical slices. Keep a cohesive spec unsplit otherwise — never create a redundant one-ticket wrapper. When splitting, order blockers before dependants and express dependencies through ticket links.

6. **Publish to GitHub.** Use `gh` (it infers the repo from `git remote -v`):
   - Create the spec issue: `gh issue create --title "Spec: <feature>" --body-file <spec.md>`.
   - When split, create each ticket issue in dependency order, linking the parent spec and each blocker.
   - On a rerun, reconcile against existing issues and update rather than duplicate.

7. **Mark ready.** Apply the `spec:ready` status label to the spec issue (and to each ticket). Create the label first if it does not exist. Remove any earlier `spec:in-progress` / `spec:reviewed` label.

8. **Report.** Summarize the spec issue link, any tickets in dependency order, the agreed testing seams, and confirm status → `ready`.

See `docs/spec-lifecycle.md` for the status-label vocabulary, base-branch configuration, and branch naming.
