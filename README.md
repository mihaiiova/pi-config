# pi-config

Shared pi configuration — extensions, skills, prompts, and themes synced across machines via git. Package dependencies are tracked as a list and installed globally via `pi install`.

## Structure

```
pi-config/
├── extensions/       # Custom TypeScript extensions
│   ├── pi-sync/      #   /pi-sync — git push/pull + reconcile packages
│   └── skills-select/ #  /skills-select — per-project skill allowlist
├── skills/           # Agent skills (SKILL.md directories)
├── prompts/          # Prompt templates (.md)
├── themes/           # Theme files (.json)
└── package.json      # Pi manifest + package list (pi.packages)
```

## Spec lifecycle

Two discovery commands feed a four-stage lifecycle:

- `/spec-backlog` — review open issues against the code and recommend what product/project work to do next.
- `/spec-audit` — read-only technical-health audit that consolidates findings into prioritized technical initiatives.
- `/spec-new` — define a **normal spec** or an **epic** of child specs; publishes via the trusted plan applier.
- `/spec-start` — implement one spec with TDD (refuses epic containers).
- `/spec-review` — verify one implementation.
- `/spec-close` — merge, close, clean up; updates parent-epic progress.

Example (normal):

```text
/spec-new "Add CSV export"      → Spec #120
/spec-start #120
/spec-review
/spec-close
```

Example (epic):

```text
/spec-new "Rework content ingestion"
→ Epic #200
   → Spec #201
   → Spec #202 (blocked by #201)
   → Spec #203 (blocked by #201)

/spec-start #201   … /spec-close
/spec-start #202   …
```

`/spec-start` cannot start an epic directly. See [docs/spec-lifecycle.md](docs/spec-lifecycle.md) for status labels, parent/child and blocker relationships, branch naming, and base-branch configuration.

## How packages work

Packages are tracked in `package.json` under `pi.packages` and installed globally on each machine via `pi install`. They live in `~/.pi/agent/npm/`, **not** in pi-config's `node_modules/`. This avoids duplicate-loading conflicts.

`/pi-sync` reconciles the list against what's installed:
- Packages in `pi.packages` but not installed → auto-installs
- Packages installed but not in `pi.packages` → asks which to keep/remove
- Then runs `pi update --extensions`

## Setup on a new machine

```bash
git clone <remote-url> /path/to/pi-config
pi install /path/to/pi-config
```

Then run `/pi-sync` to install all listed packages. Then `/reload`.

## Day-to-day: syncing

Run **`/pi-sync`** from any pi session. It handles:

1. `git fetch` + auto-commit local changes + `git pull --rebase` + `git push`
2. Installs any new packages added to `pi.packages`
3. Asks about packages installed locally but not in the list
4. `pi update --extensions`

If merge conflicts: resolve manually in your pi-config repo, then re-run `/pi-sync`.

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
