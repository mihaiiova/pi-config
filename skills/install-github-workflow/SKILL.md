---
name: install-github-workflow
description: Install or update the shared Pi GitHub Actions issue workflow in the current local project and explain how to use it. Use when the user says "install GitHub workflow", asks to add the Pi workflow to a project, or wants to enable @pi define-spec, @pi create-spec, and @pi implement in a repository.
---

# Install the Pi GitHub workflow

Install the thin project caller for `mihaiiova/pi-config`; do not copy the reusable orchestration into the project.

## Inspect the project

1. Work from the current repository root. Read every applicable `AGENTS.md` and inspect existing `.github/workflows/` files before editing.
2. Discover the project-level verification command from existing CI, package scripts, task runners, or repository instructions. Prefer the same complete command CI uses. Ask only when no reliable command can be discovered; an empty value is allowed but must be reported.
3. Inspect existing issue labels with `gh label list` when GitHub access is available. Use the established implementation-ready label, or an empty `ready_label` if none exists. Do not invent or rename project labels.
4. Check whether `.github/workflows/pi.yml` already exists. Update it without discarding unrelated intentional configuration.

## Install the caller

Use [assets/pi.yml](assets/pi.yml) as the canonical shape. Write the result to `.github/workflows/pi.yml` and replace every `__...__` placeholder:

- `__PI_CONFIG_REF__`: resolve the full remote commit SHA of `mihaiiova/pi-config` `master` with `gh api repos/mihaiiova/pi-config/commits/master --jq .sha` or `git ls-remote https://github.com/mihaiiova/pi-config.git refs/heads/master`. Do not use an unpushed local `HEAD`. Use `master` only when the remote SHA cannot be resolved and disclose that weaker pin.
- `__READY_LABEL__`: the discovered ready label or an empty string.
- `__VERIFICATION_COMMAND__`: the exact discovered project verification command.

Keep `agent:defining` synchronized between the caller `if` condition and `defining_label`. Keep the default `pi-agent` runner label unless the user or repository already specifies another registered label. Do not add secrets: the reusable workflow uses GitHub's ephemeral token, while Pi provider authentication belongs on the self-hosted runner.

Do not commit or push unless the user asks.

## Verify the installation

1. Parse the workflow as YAML using an available local parser.
2. Confirm it listens only to new `issue_comment` events, grants `contents`, `issues`, and `pull-requests` write permissions, calls the shared workflow at the resolved ref, and includes the definition-label continuation condition.
3. Run `git diff --check` and show the focused diff.
4. State that the workflow file must reach the project's default branch before issue comments can trigger it.
5. Report the one-time external prerequisite separately: a self-hosted runner available to the repository with the selected label, plus `pi`, `git`, `gh`, and `jq`; Pi must already be provider-authenticated and `pi-config` installed globally on that runner.

## Explain usage

End the handoff with this project workflow:

1. Create or choose a GitHub issue and comment `@pi define-spec`.
2. Answer each follow-up normally while the definition label is present.
3. After shared understanding is reported, comment `@pi create-spec`; it creates or resumes the linked spec and any dependency-aware tickets without duplicates.
4. On a ready spec or generated ticket, comment `@pi implement`; it performs TDD, runs code review, fixes findings, reruns the configured verification command, and then opens or updates a pull request.

Mention that only repository users with write, maintain, or admin permission can invoke commands and that commands run on issues, not pull-request comments.
