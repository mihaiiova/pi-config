# Spec lifecycle

The full lifecycle for taking work from idea to merged. Two discovery commands feed it, then four stages move one spec at a time through definition, implementation, verification, and integration.

```text
/review-backlog   →  what product/project work should we do?
/audit-codebase   →  what technical work should we improve?
        │
        ▼
/new-spec         →  define a normal spec or an epic of child specs
/start-spec       →  implement one spec (TDD)
/review-spec      →  verify one implementation
/close-spec       →  merge, close, clean up
```

Lower-level skills remain available as primitives: `grill-me`/`grilling`, `to-spec`, `to-tickets`, `tdd`, `code-review`, `codebase-design`, `domain-modeling`, `improve-codebase-architecture`, `review-session`.

## Normal spec vs epic

`/new-spec` decides which shape the work takes:

- **Normal spec** — one cohesive development unit, one spec issue.
- **Epic** — a planning container holding multiple independently implementable child specs. The epic is **not** directly implementable; `/start-spec` refuses it.

`/new-spec` writes a JSON plan and applies it via `scripts/spec/apply-plan.sh`, which validates it (duplicate ids, unknown dependencies, cycles, ordering), creates issues in dependency-safe order, links parent ↔ child and blockers, applies status labels, and is idempotent on rerun.

## Status labels

Each stage is tracked as a GitHub label on the spec issue. Created on demand.

| Status word | GitHub label       | Set by         | Removed by     |
|-------------|--------------------|----------------|----------------|
| epic        | `spec:epic`        | `/new-spec`    | —              |
| ready       | `spec:ready`       | `/new-spec` (or `/close-spec` clearing blockers) | `/start-spec` |
| in-progress | `spec:in-progress` | `/start-spec`  | `/review-spec` |
| reviewed    | `spec:reviewed`    | `/review-spec` | `/close-spec`  |
| done        | `spec:done`        | `/close-spec`  | —              |

These lifecycle labels are distinct from the triage vocabulary (`ready-for-agent`, `needs-triage`, …). They can coexist.

## Parent/child and blocker relationships

Both are stored as markdown links in issue bodies (not native GitHub sub-issues, which the `gh` CLI does not reliably expose):

- **Parent/child**: a child spec's body has `## Parent` linking the epic; the epic's body has `## Child spec issues` linking every child.
- **Blocker/dependency**: a child's (or ticket's) body has `## Blocked by` listing the issues that must close first.

Each artifact also carries a hidden idempotency marker (`<!-- pi:new-spec:v1 repo=… kind=… id=… -->`) so reruns reuse existing issues instead of duplicating them. Stable `id` values are kebab-case slugs in the plan JSON, independent of GitHub issue numbers; the applier resolves them to real links.

## Branch naming

Implementation happens on `spec/<id>-<slug>`, branched from the configured base branch:

- `<id>` — the spec's GitHub issue number.
- `<slug>` — a short kebab-case slug from the spec title.

## Base branch

Resolved in this order:

1. `spec.baseBranch` in the project's `.pi/settings.json`.
2. The repository's default branch.

## Examples

Normal spec:

```text
/new-spec "Add CSV export"
→ Spec #120
/start-spec #120
/review-spec
/close-spec
```

Epic:

```text
/new-spec "Rework content ingestion"
→ Epic #200
   → Spec #201  (content-source-foundation)
   → Spec #202  (youtube-ingestion)     blocked by #201
   → Spec #203  (podcast-ingestion)     blocked by #201
   → Spec #204  (ui-migration)          blocked by #202, #203

/start-spec #201
/review-spec
/close-spec           # closes #201; unblocks #202 and #203 (they become spec:ready)

/start-spec #202
...
```

`/start-spec` cannot start an epic directly. On an epic it reports:

> This is an epic. Start one of its ready child specs instead.

and lists the currently startable children. When `/close-spec` closes a child, it clears that child's blockers on its siblings and reports when all children are complete so the epic can be closed explicitly.
