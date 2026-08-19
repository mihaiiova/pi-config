# Spec lifecycle

The workflow separates cheap capture/discovery from definition and implementation.

```text
/new-idea         → remember a shallow thought for later
/review-backlog   → prioritize the full known work queue
/audit-codebase   → discover technical problems not yet represented
        │
        ▼
/new-spec         → define one spec or an epic of specs
/start-spec       → implement one spec (TDD)
/review-spec      → verify one implementation
/close-spec       → merge/close one spec, or close a completed epic
```

Lower-level skills remain available as primitives: `grill-me`/`grilling`, `to-spec`, `tdd`, `code-review`, `codebase-design`, `domain-modeling`, `improve-codebase-architecture`, `review-session`.

## Core concepts

There are only two planning artifacts:

- **Spec** — the atomic implementation unit. `/start-spec`, `/review-spec`, and implementation-mode `/close-spec` operate on a spec.
- **Epic** — a planning container for two or more independently implementable specs. An epic has no implementation branch and cannot be started directly.

There is no ticket layer beneath a spec. If work cannot reasonably be implemented/reviewed as one cohesive spec, split it into an epic of specs.

## Idea capture

`/new-idea` creates one shallow GitHub issue with the `idea` label. It is intentionally underdefined. `/review-backlog` may later recommend `/new-spec #<issue>` when the idea remains valuable.

## Spec vs epic

Prefer a normal spec even when the work spans frontend/backend/database or multiple modules, as long as it is one cohesive outcome. Prefer an epic only when children are independently meaningful implementation/review units. Technical prerequisites alone do not justify child specs unless they have independent product or architectural value.

## Plan identity and convergence

`/new-spec` writes a plan with:

- an opaque collision-resistant `plan_id`, generated once per definition and reused when that same definition is resumed;
- readable kebab-case artifact ids scoped to the plan.

The applier stores a hidden marker containing repository + plan id + artifact kind + artifact id. Re-running the same plan is **idempotent and convergent**: existing GitHub issues are reused and their title/body are updated to the latest plan instead of duplicated. A different planning effort must get a new `plan_id`, even if it happens to use the same title/slug as an old effort.

## Lifecycle state

For non-epic specs, these labels are mutually exclusive lifecycle states:

| State | Label | Set by |
|---|---|---|
| ready | `spec:ready` | `/new-spec`, or `/close-spec` when blockers clear |
| in progress | `spec:in-progress` | `/start-spec` |
| reviewed | `spec:reviewed` | `/review-spec` |
| done | `spec:done` | `/close-spec` |

`spec:epic` is a **type marker**, not a lifecycle state. A completed epic may carry both `spec:epic` and `spec:done`.

State transitions should remove other non-epic lifecycle-state labels before applying the target state. Re-running `/new-spec` must not move a spec backwards from `in-progress`, `reviewed`, or `done` to `ready`.

## Parent/child and blockers

Relationships are stored as markdown links because native sub-issues are not relied on:

- child spec → `## Parent` link to epic;
- epic → `## Child spec issues` links to all children;
- child spec → `## Blocked by` links to sibling specs that must close first.

Parent/child structure and dependency/blocker structure are separate concepts.

## Branching and resume

Implementation branch: `spec/<issue-number>-<slug>`, based on `spec.baseBranch` in `.pi/settings.json` or the repository default branch.

`/start-spec` is resumable:

- no branch → create from synced base;
- existing branch that clearly belongs to the spec → resume it;
- ambiguous same-named branch → refuse rather than overwrite/reset.

A missing configured base branch is an error; lifecycle commands never silently create it.

## Epic completion

Closing the last child does not silently close its epic. It reports that the epic is complete. Then:

```text
/close-spec #<epic>
```

verifies all children are done and closes the container explicitly, without any branch operations.

## Examples

Normal spec:

```text
/new-spec "Add CSV export"
→ Spec #120 (spec:ready)
/start-spec #120
/review-spec
/close-spec
```

Epic:

```text
/new-spec "Rework content ingestion"
→ Epic #200
   → Spec #201 foundation
   → Spec #202 YouTube ingestion  blocked by #201
   → Spec #203 podcast ingestion  blocked by #201

/start-spec #201
/review-spec
/close-spec

/start-spec #202
...

# after all children are done
/close-spec #200
```
