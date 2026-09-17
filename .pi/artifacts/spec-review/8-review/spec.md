## Parent

[Epic: /pi-config — project setup, tiered model routing, and startup drift detection](https://github.com/mihaiiova/pi-config/issues/5)

## Problem Statement

When a new pi session starts, the user cannot tell whether their local pi-config is behind the git remote (needs `/pi-sync`), has new or changed extensions/skills not yet loaded (needs `/reload`), or both. pi-config has no version marker, so there is no reliable signal to compare.

## Solution

Add a version marker to pi-config (a `version` field in package.json, bumped by `/spec-release`) and a session-start check that compares local state against remote/installed state, reporting one verdict: `pi-sync needed`, `reload needed`, `both`, or `none`. The check runs on session start without blocking and respects offline settings.

## User Stories

1. As a developer, I want a startup notice telling me my pi-config is behind origin, so I know to run `/pi-sync`.
2. As a developer, I want a startup notice when new extensions/skills are present but not loaded, so I know to run `/reload`.
3. As a developer, I want a single "both" verdict when I need sync and reload, so I do both in one go.
4. As a developer, I want no noise when everything is current, so startup stays quiet.
5. As a developer, I want the check to skip network calls in offline mode, so I'm not blocked without connectivity.
6. As a developer, I want package drift (installed vs `pi.packages`) folded into the sync verdict, so stale packages surface too.

## Implementation Decisions

- Version source: a `version` field added to package.json; bumped by the release flow (`/spec-release`), consistent with the spec block's `versionFile`/`tagPrefix`.
- Drift signal = git `HEAD` vs `origin/HEAD` (after fetch) plus installed packages vs `pi.packages`. Behind on git or a package mismatch ⇒ `/pi-sync` needed.
- Reload signal = new/changed extension or skill files since the last loaded marker ⇒ `/reload` needed.
- Implementation is a `session_start` handler in an extension that emits a non-blocking notify/widget, not a modal prompt.
- Respects `PI_OFFLINE`/`PI_SKIP_VERSION_CHECK` to avoid network; degrades to "unknown/offline" gracefully.
- Verdict enum: `none | sync | reload | both`.

## Testing Decisions

- Unit-test the verdict computation given (local HEAD, remote HEAD, installed packages, desired packages, changed-file marker) → exact verdict.
- Mock git and package sources; do not require network in tests.
- Test offline degradation (no remote ⇒ not "sync needed").
- Prior art: the pi-sync extension's git client and package-diff helpers, and the existing `tests/` directory.

## Out of Scope

- Auto-syncing or auto-installing (still user-invoked `/pi-sync`).
- Changing `/pi-sync` or `/reload` behavior itself.
- Model tiering (child 1) and skill splits (child 2).

## Further Notes

- The version marker should be low-friction and not require a commit per change; HEAD comparison is the primary drift signal, with the version field as a human-readable label.

## Blocked by

- [Spec: /pi-config — interactive project setup and model-tier routing](https://github.com/mihaiiova/pi-config/issues/6)

<!-- pi:new-spec:v2 repo=mihaiiova/pi-config plan=plan-5b4bf1c0c7d24e918b084e8c kind=child id=startup-drift-check -->