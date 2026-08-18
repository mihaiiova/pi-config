# pi-config

Shared pi configuration — extensions, skills, prompts, and themes synced across machines via git. Package dependencies are tracked as a list and installed globally via `pi install`.

## Structure

```
pi-config/
├── .github/workflows/ # Reusable self-hosted Pi agent workflow
├── extensions/       # Custom TypeScript extensions
│   ├── pi-sync/      #   /pi-sync — git push/pull + reconcile packages
│   └── skills-select/ #  /skills-select — per-project skill allowlist
├── skills/           # Agent skills (SKILL.md directories)
├── prompts/          # Prompt templates (.md)
├── themes/           # Theme files (.json)
└── package.json      # Pi manifest + package list (pi.packages)
```

## GitHub Actions agent

Projects can delegate `@pi help`, `@pi define-spec`, `@pi create-spec`, `@pi status`, and `@pi implement` issue comments to the reusable self-hosted workflow in this repository. The v1 workflow supports resumable spec creation, automatic labeled definition interviews, project-level labels/branches/verification/timeouts, and an offline regression suite. See [docs/github-actions.md](docs/github-actions.md) for the one-time runner setup, security model, and tiny per-project caller workflow.

From any local project where this package is installed, tell Pi **“install GitHub workflow”**. The `install-github-workflow` skill will inspect that project, add or update `.github/workflows/pi.yml`, verify it, and explain how to use the issue commands.

## How packages work

Packages are tracked in `package.json` under `pi.packages` and installed globally on each machine via `pi install`. They live in `~/.pi/agent/npm/`, **not** in pi-config's `node_modules/`. This avoids duplicate-loading conflicts.

`/pi-sync` reconciles the list against what's installed:
- Packages in `pi.packages` but not installed → auto-installs
- Packages installed but not in `pi.packages` → asks which to keep/remove
- Then runs `pi update --extensions`

## Setup on a new machine

```bash
git clone <remote-url> ~/dev/pi-config
pi install ~/dev/pi-config
```

Then run `/pi-sync` to install all listed packages. Then `/reload`.

## Day-to-day: syncing

Run **`/pi-sync`** from any pi session. It handles:

1. `git fetch` + auto-commit local changes + `git pull --rebase` + `git push`
2. Installs any new packages added to `pi.packages`
3. Asks about packages installed locally but not in the list
4. `pi update --extensions`

If merge conflicts: resolve manually in `~/dev/pi-config`, then re-run `/pi-sync`.

After syncing, `/reload` to pick up new or changed extensions.

## Adding a new npm package

```bash
pi install npm:<package-name>
```

Then add it to `pi.packages` in `package.json`:

```json
"pi": {
  "packages": [
    "npm:pi-mcp-adapter",
    "npm:<new-package>"
  ]
}
```

Commit, push. On the other machine, `/pi-sync` will pick it up.

## Adding a new custom extension or skill

Place it in the appropriate directory:

- `extensions/<name>/index.ts` for extensions
- `skills/<name>/SKILL.md` for skills

Commit, push, `/pi-sync` on the other machine, `/reload`.
