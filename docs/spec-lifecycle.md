# Spec lifecycle

The four-stage lifecycle for taking a piece of work from idea to merged. Each stage is an interactive slash command run in a normal Pi session; GitHub is used only to publish and track the spec and its tasks, and to close them at the end.

```text
/new-spec      understand → define → publish → ready
/start-spec    validate → branch → implement (tdd) → in-progress
/review-spec   verify → code-review → review-session → reviewed
/close-spec    merge → close issues → delete branch → done
```

## Status labels

Each stage is tracked as a GitHub label on the spec issue. The labels are created on demand on first use.

| Status word | GitHub label      | Set by        | Removed by    |
|-------------|-------------------|---------------|---------------|
| ready       | `spec:ready`      | `/new-spec`   | `/start-spec` |
| in-progress | `spec:in-progress`| `/start-spec` | `/review-spec`|
| reviewed    | `spec:reviewed`   | `/review-spec`| `/close-spec` |
| done        | `spec:done`       | `/close-spec` | —             |

These lifecycle labels are distinct from the triage vocabulary (`ready-for-agent`, `needs-triage`, …) managed by `triage` / `setup-matt-pocock-skills`. They can coexist on the same issue.

## Branch naming

Implementation happens on `spec/<id>-<slug>`, branched from the configured base branch:

- `<id>` — the spec's GitHub issue number.
- `<slug>` — a short kebab-case slug derived from the spec title.

## Base branch

The branch the spec is cut from, reviewed against, and merged back into. Resolved in this order:

1. `spec.baseBranch` in the project's `.pi/settings.json`.
2. The repository's default branch.

## Skill composition

Each stage composes the established, lower-level skills rather than redefining their methods:

```text
new-spec    → grill-me → grilling → to-spec → to-tasks → publish + label
start-spec  → tdd
review-spec → code-review → review-session → acceptance + task verification
close-spec  → merge → issue close → branch delete
```
