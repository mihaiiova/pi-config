# GitHub Actions Pi agent

`pi-config` provides a reusable workflow for these issue-comment commands:

- `@pi define-spec` — use `grill-me` to resolve one design decision per issue-comment round, then publish the agreed definition.
- `@pi create-spec` — use `to-spec`, then `to-tickets` when splitting is justified; create the linked spec and any dependency-aware implementation tickets before closing the definition.
- `@pi implement` — use `tdd` at the spec's pre-agreed testing seams, then open or update a pull request.

## Server setup (once)

Install and register a GitHub Actions self-hosted runner with the `pi-agent` label. The runner must have:

- `pi`, already authenticated with the model provider
- `git`, GitHub CLI (`gh`), and `jq`
- this repository installed as Pi's global package (`pi install /path/to/pi-config`)

Keep Pi's provider credentials and GitHub runner registration outside repositories. The workflow uses the ephemeral `GITHUB_TOKEN` supplied by Actions for repository operations; no repository secret is required by this implementation. Configure Pi provider authentication in Pi's runner-local auth store rather than additional environment variables so planning runs can use a sanitized environment.

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

The workflow uses GitHub's called-workflow metadata to check out the exact `pi-config` commit used by the caller, fetches the issue plus every comment through pagination, and appends the selected skill chain to Pi's normal system prompt. Neither checkout persists credentials. The thread is explicitly treated as untrusted discussion data: `define-spec` and `create-spec` run with read-only Pi tools in a sanitized environment containing no GitHub credential. Only `implement` receives the ephemeral token, with Git authorization provided through process environment rather than repository or global Git configuration.

An `always()` cleanup step removes the fetched thread, generated plans and results, temporary GitHub CLI configuration, and the nested orchestration checkout from the persistent self-hosted runner. Cleanup validates both target paths before removing them.

`create-spec` separates reasoning from mutation: Pi writes a JSON plan containing the spec plus zero or multiple tracer-bullet tickets. A shell helper validates the plan, creates the spec first, then creates tickets in dependency order with real parent and blocker links. Cohesive work stays on the spec; split work produces at least two agent-ready tickets. The definition closes only after every creation succeeds. If unresolved product or testing decisions block synthesis, the helper posts those questions and leaves the definition open. The full repository label vocabulary is included with the issue context so the skills can apply existing ready labels without inventing labels.

## Skill composition

The reusable workflow composes each established skill with a thin GitHub adapter:

```text
define-spec  → grill-me → grilling → asynchronous definition comment
create-spec  → to-spec → to-tickets → validated spec-and-ticket plan
implement    → tdd                  → branch, tests, implementation, PR
```

The established skills are loaded first and the GitHub adapter last. This preserves their methods while adapting interactive prompts and direct tracker writes to safe Actions behavior. `define-spec` asks only one question per run; include `@pi define-spec` in each answer until it reports shared understanding. `create-spec` records testing seams in the spec and creates vertical-slice tickets only when useful. `implement` follows each ticket to its parent spec, treats the documented seams as the user confirmation required by `tdd`, and refuses to start while a declared blocking ticket is open.
