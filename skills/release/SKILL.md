---
name: release
description: Promote accumulated, completed spec work from the development integration branch to main or master. Verify the release, derive a spec-driven changelog and SemVer bump, update version files, create or resume the pull request, merge it, tag it, publish the GitHub release, and resync development.
---

# Release

Turn the completed specs accumulated on the integration branch into one deliberate release. This is the only lifecycle skill that promotes integration to the release branch or creates release tags/releases.

## Process

1. **Resolve branches and resume state.** Read `.pi/settings.json`: `spec.baseBranch` defaults to `development`; `spec.releaseBranch` defaults to the repository default (`main` or `master`). Fetch origin and inspect local/remote branches, an existing integration-to-release pull request, release commits, tags, and GitHub releases before mutating anything. If integration is missing locally and remotely, create it from the synced release branch and push it with upstream tracking. Track existing remote branches and fast-forward only; never reset or recreate divergent history. Require a clean working tree.

2. **Find unreleased work.** Inspect commits in `<release>..<integration>`. If there are none and no incomplete release transaction exists, report a no-op. Identify included specs from their integration merge commits and referenced GitHub issues; include only completed specs with `spec:done` evidence. Refuse unexplained commits or incomplete lifecycle work until it is explicitly accounted for.

3. **Run the release gate.** Run the practical full regression suite, typecheck, lint, and build from `spec.verification`, falling back to repository discovery. Then run `spec.verification.release` when configured; this is the strongest practical suite and may include full E2E or external-infrastructure checks. Record every command and result. Do not continue past failures or silently omit an available check.

4. **Determine release impact.** Read each included spec's `## Release impact` value: `major`, `minor`, `patch`, or `none`. Choose the highest SemVer impact. If any included spec omits a release impact, recommend one from the user-visible behavior but ask for confirmation when the resulting bump is ambiguous; never silently infer a breaking release. `major` means intentional breaking behavior/API, `minor` a backward-compatible user-facing capability, `patch` a fix/internal improvement/docs/maintenance, and `none` no independently releasable change.

5. **Prepare release metadata.** Discover the canonical current version and changelog, using `spec.release.versionFiles` and `spec.release.changelogFile` overrides when present. Refuse conflicting versions or an ambiguous source of truth. Update every canonical version file consistently. Update the changelog from the completed spec titles, outcomes, and issue links—not raw commit subjects—under the new version and current date. Preserve the project's existing changelog format.

6. **Create or reuse the release commit.** On integration, create one `chore(release): v<version>` commit containing only release metadata and push it. On resume, reuse an identical existing release commit; if its version or contents disagree with the computed release, stop rather than layering another bump.

7. **Create or resume the pull request.** Reuse the open integration-to-release PR when present; otherwise open one with the version, spec-driven changelog summary, included issues, and verification evidence. Review the complete release diff and wait for required CI/checks. Resolve blockers and rerun affected release gates before continuing.

8. **Merge exactly once.** Merge the PR only after review and required checks pass. If it is already merged, verify that the release branch contains the intended release commit and resume. Never force-push either long-lived branch.

9. **Tag and publish exactly once.** Fast-forward the local release branch. Create annotated tag `v<version>` on the resulting release-branch commit and push it. If the tag exists, require it to point to that exact commit. Create the GitHub release from the spec-driven changelog; if it already exists, verify and reuse it rather than duplicating it.

10. **Resync integration.** Fast-forward integration to the released commit and push it so the next spec starts from the released state. Refuse a non-fast-forward reconciliation and report the divergence.

11. **Report.** Include version and bump rationale, included specs, verification, changelog/version files, PR and merge commit, tag, GitHub release URL, and final branch synchronization. If stopped, name the exact safe resume point; rerunning `/release` must continue from observed state without duplicating commits, PRs, tags, or releases.
