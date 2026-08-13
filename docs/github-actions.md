# GitHub Actions Pi agent

`pi-config` provides a reusable workflow for these issue-comment commands:

- `@pi define-spec` — turn the full discussion into a decision-ready definition and comment it back.
- `@pi create-spec` — turn an agreed definition into linked implementation issues, then close the definition after every child issue is created.
- `@pi implement` — implement the agreed issue on a branch and open or update a pull request.

## Server setup (once)

Install and register a GitHub Actions self-hosted runner with the `pi-agent` label. The runner must have:

- `pi`, already authenticated with the model provider
- `git`, GitHub CLI (`gh`), and `jq`
- this repository installed as Pi's global package (`pi install /path/to/pi-config`)

Keep Pi's provider credentials and GitHub runner registration outside repositories. The workflow uses the ephemeral `GITHUB_TOKEN` supplied by Actions for repository operations; no repository secret is required by this implementation.

The runner executes code from repositories that opt in. Use a dedicated, isolated runner account or machine and do not attach sensitive credentials unrelated to this workflow.

## Project setup

Add this single caller as `.github/workflows/pi.yml` in each project:

```yaml
name: Pi

on:
  issue_comment:
    types: [created]

permissions:
  contents: write
  issues: write
  pull-requests: write

jobs:
  pi:
    if: contains(github.event.comment.body, '@pi')
    uses: mihaiiova/pi-config/.github/workflows/pi-agent.yml@master
```

For stable production use, replace `master` with a release tag or full commit SHA. A project can also set a different runner label:

```yaml
    with:
      runner: my-pi-runner
```

That is the entire required per-project workflow. Project behavior stays in its normal `AGENTS.md`, `.pi/settings.json`, and project-local skills. The reusable workflow runs Pi from the project root and does not disable normal skill discovery.

## Authorization and behavior

Only comments from users with `write`, `maintain`, or `admin` permission are accepted. Pull-request comments and unsupported commands are rejected before project code is checked out. Runs are serialized per issue.

The workflow uses GitHub's called-workflow metadata to check out the exact `pi-config` commit used by the caller, fetches the issue plus every comment through pagination, and appends only the selected command skill to Pi's normal system prompt. The checked-out orchestration directory is locally excluded from the project Git worktree. The thread is explicitly treated as untrusted discussion data; `define-spec` and `create-spec` Pi processes do not receive `GH_TOKEN`.

`create-spec` separates reasoning from mutation: Pi writes a JSON issue plan, and a shell helper validates it before creating issues. The parent definition is commented on and closed only after all planned child issues were created successfully. If unresolved product decisions block the split, the helper posts those questions and leaves the parent open.
