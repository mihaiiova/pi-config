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
/review-spec      → targeted tests, regression gate, review
/close-spec       → merge one spec into development and close it
/release          → promote development to main/master and publish
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

Implementation branch: `spec/<issue-number>-<slug>`, based on the integration branch. The integration branch is `spec.baseBranch` in `.pi/settings.json`, defaulting to `development`. The release branch is `spec.releaseBranch`, defaulting to the repository default (`main` or `master`).

`/start-spec` and `/close-spec` fetch before resolving these branches. If the integration branch is absent both locally and remotely, they create it once from the synced release branch and push it. Existing branches are only tracked or fast-forwarded; lifecycle skills never reset or recreate divergent history. Re-running `/close-spec` recognizes an already-integrated commit, closed issue, applied label, or deleted feature branch and resumes the unfinished steps.

`/start-spec` is resumable:

- no branch → create from synced base;
- existing branch that clearly belongs to the spec → resume it;
- ambiguous same-named branch → refuse rather than overwrite/reset.

A missing configured release branch or unsafe branch divergence is an error.

## Verification tiers

During implementation, `/start-spec` runs the smallest relevant tests for a fast TDD loop. `/review-spec` runs targeted/newly affected tests first, followed by the full practical regression suite and typecheck, lint, build, and static analysis. Targeted success never replaces the regression gate. Expensive E2E or external-infrastructure checks may use a documented smoke tier during review; `/release` runs the strongest practical configured release gate.

Configure commands when repository discovery would be ambiguous:

```json
{
  "spec": {
    "baseBranch": "development",
    "releaseBranch": "main",
    "verification": {
      "targeted": "npm test -- <affected tests>",
      "regression": "npm test",
      "typecheck": "npm run typecheck",
      "lint": "npm run lint",
      "build": "npm run build",
      "release": "npm run test:e2e"
    },
    "release": {
      "versionFiles": ["package.json"],
      "changelogFile": "CHANGELOG.md"
    }
  }
}
```

Every command is optional; skills discover the repository convention when it is absent and record commands they cannot practically run. `versionFiles` and `changelogFile` are optional overrides for repositories whose canonical release metadata is not obvious.

## Releases

Each spec records `## Release impact` as `major`, `minor`, `patch`, or `none`. `/release` chooses the highest impact among completed specs accumulated on integration, asks when missing metadata makes the bump ambiguous, and builds the changelog from specs rather than commit subjects. It then updates release metadata on integration, creates or resumes the integration-to-release PR, verifies CI, merges, tags `v<version>`, creates or reuses the GitHub release, and fast-forwards integration to the released commit.

The release transaction is resumable and idempotent. Before each mutation it inspects existing release commits, PRs, merge state, tags, and GitHub releases. A rerun resumes the first incomplete step; it does not create a second version bump, PR, tag, or release.

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
/release
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
