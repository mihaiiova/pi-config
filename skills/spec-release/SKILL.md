---
name: spec-release
description: Cut a product release. Merge the development branch into the production branch (directly or via a pull request), propose a semver bump, write release notes, tag, and create the GitHub Release. Supports a --dry-run preview. Use after a batch of closed specs is ready to ship.
---

# Release

Promote a completed batch of work from the development branch to production. `/spec-release` owns the release boundary only — merge, version, notes, tag, and GitHub Release. It never edits product code or decides scope.

## Boundaries

- Merge only development → production, never the reverse.
- Never create a missing development or production branch implicitly; refuse and tell the user which branch is missing.
- Do not edit product code, tests, or dependencies to "fix" a release. A broken release is a reason to refuse and re-run `/spec-review`/`/spec-close` on the offending spec.
- Do not push the merge, the tag, or the GitHub Release until the user confirms the version.

## Options

- `--dry-run` — compute everything (diff, version, notes, merge path) but mutate nothing; print the plan and stop before any push, tag, or release.

## Configuration

Reads from `.pi/settings.json` (see `docs/spec-lifecycle.md` for the full schema and defaults):

- `spec.baseBranch` (default `development`) and `spec.releaseBranch` (default `main`) — the integration and production branches.
- `spec.tagPrefix` (default `v`) — the git tag prefix.
- `spec.versionFile` — the manifest holding the version (`package.json`, `pubspec.yaml`, `Cargo.toml`, `pyproject.toml`); read to detect and optionally bump the version.
- `spec.changelogFile` — when set, prepend the new release entry to it and commit on production.
- `spec.release.viaPullRequest` (default `false`) — when `true`, open and merge a `development → production` pull request instead of pushing production directly (for protected production branches).
- `spec.release.draft` (default `false`) — create the GitHub Release as a draft.
- `spec.release.bumpDevAfterRelease` (default `true`) — bump `development` to a `-dev` version after the release when `versionFile` is set.

## Process

1. **Resolve and sync branches.** Read `spec.baseBranch` and `spec.releaseBranch`. Verify both exist locally/remotely. `git fetch origin`, then fast-forward both local branches to their remotes.

2. **Confirm there is work to ship.** Compute `git log --oneline <production>..<development>`. If empty, report "nothing to release" and stop.

3. **Propose a version.** Detect the current version from the latest `<tagPrefix>*` tag, falling back to `versionFile`. Classify the pending work since the last tag — breaking change, new feature, fix, or internal-only — from the merged specs, and propose the matching semver bump (major/minor/patch) with reasoning. Confirm the exact version string with the user before proceeding.

4. **Draft release notes.** Gather what ships: closed issues carrying `spec:done` since the last tag, plus merge commits in `<last-tag>..<development>`. Write a changelog grouped by type (breaking, features, fixes, internal), including the tag, date, and issue links.

5. **Dry-run (when requested).** Print the version, tag, merge path (direct push vs pull request), release notes, and affected branches, then stop without mutating anything.

6. **Cut the release.**
   - **Direct path** (`release.viaPullRequest` false): checkout production, fast-forward to its remote, merge `development` with a merge commit (do not fast-forward), and push production.
   - **Pull-request path** (`release.viaPullRequest` true): create or update a `development → production` pull request, then `gh pr merge` it once it is mergeable and CI (if any) is green.
   - Create the annotated tag `<tagPrefix><version>` on production and push it.
   - When `changelogFile` is set, prepend the new entry and commit it on production.
   - Run `gh release create <tag>` with the drafted notes, adding `--draft` when `release.draft`.

7. **Bump development for the next cycle.** When `bumpDevAfterRelease` and `versionFile` are set, bump `development` to `<next-patch>-dev` and push, so the next release starts from a fresh dev version.

8. **Report.** Include the version, merge commit or pull request, pushed production branch, tag, GitHub Release URL, and the specs shipped.

## Relationship to the lifecycle

`/spec-close` merges finished specs into the development branch. `/spec-release` is the only command that moves development into production. Releasing does not touch spec lifecycle labels.
