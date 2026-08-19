---
name: new-idea
description: Capture a shallow idea as one lightweight GitHub issue for later discussion, without starting the spec-definition process.
---

# New idea

Capture something worth remembering without pretending it is ready to build. `/new-idea` is intentionally cheap; `/new-spec` is where definition and commitment happen.

## Boundaries

- Create exactly one GitHub issue.
- Do not create branches, child issues, specs, epics, acceptance criteria, implementation plans, or product-code changes.
- Do not invoke `/to-spec`, `/tdd`, or architecture workflows.
- Do not invoke `/grill-me` unless the user explicitly asks to discuss/define the idea now; if they do, hand off to `/new-spec` instead of expanding the idea issue in place.
- Preserve the user's wording and uncertainty. Do not inflate a short thought into an elaborate feature proposal.

## Process

1. **Capture the thought.** Extract a concise title and the minimum useful context already supplied by the user.

2. **Cheap duplicate check.** Search open GitHub issues by the core domain terms. Do not deep-scan the codebase. If an obviously equivalent open issue exists, show it and ask whether to use that issue instead of creating a duplicate.

3. **Create one shallow issue** with the `idea` label (create the label if missing). Use this shape, omitting sections with no useful content:

   ```markdown
   ## Idea

   <one or a few paragraphs preserving the user's thought>

   ## Why it might matter

   <only if the user supplied or strongly implied this>

   ## Open questions

   - <obvious unresolved questions worth remembering, not a requirements interview>

   ## Notes

   Captured for later discussion. Run `/new-spec #<issue>` when this becomes worth defining.
   ```

4. **Report the issue link/number and stop.** Do not continue into definition automatically.

## Lifecycle

`/new-idea` → shallow `idea` issue → `/review-backlog` classifies it as `needs definition` when still relevant → `/new-spec #<issue>` turns it into decision-complete work.
