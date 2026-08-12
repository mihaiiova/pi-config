# pi-config

Shared pi configuration — extensions, skills, prompts, and themes synced across machines via git.

## Structure

```
pi-config/
├── extensions/       # Custom TypeScript extensions
│   ├── pi-sync/      #   /pi-sync — git push/pull + npm install
│   └── skills-select/ #  /skills-select — per-project skill allowlist
├── skills/           # Agent skills (SKILL.md directories)
├── prompts/          # Prompt templates (.md)
├── themes/           # Theme files (.json)
├── package.json      # Pi manifest + npm dependencies
├── package-lock.json # Pinned dependency versions
└── node_modules/     # Installed npm packages (gitignored)
```

## How packages work

Pi packages (extensions/skills from npm) are declared as normal npm `dependencies` in `package.json` and loaded from `node_modules/` via `pi.extensions` paths. This means:

- **`npm install`** — installs all dependencies declared in `package.json`
- **`/pi-sync`** — runs `npm install` automatically after git pull
- Adding a new package = `npm install <pkg>` + reference it in `pi.extensions`/`pi.skills`

No `pi install` needed for packages inside pi-config. `pi install ~/dev/pi-config` is only used once on a new machine to register pi-config itself in `~/.pi/agent/settings.json`.

## Setup on a new machine

```bash
git clone <remote-url> ~/dev/pi-config
cd ~/dev/pi-config && npm install
pi install ~/dev/pi-config
```

Then restart pi, or `/reload`.

## Day-to-day: syncing

Use the built-in command **`/pi-sync`** from any pi session. It runs:

1. `git fetch`
2. `git add -A && git commit -m "sync: auto-commit before pull"` (if local changes exist)
3. `git pull --rebase`
4. `git push`
5. `npm install` (if pull brought new/changed dependencies)

If there are merge conflicts, it tells you which files to resolve. Fix them manually in `~/dev/pi-config`, then re-run `/pi-sync`.

After syncing, run `/reload` in pi to pick up new or changed extensions.

## Adding a new npm package

```bash
cd ~/dev/pi-config
npm install <package-name>
```

Then add the package's extension/skill paths to `package.json` under `pi.extensions` or `pi.skills`. For example:

```json
"pi": {
  "extensions": [
    "./extensions",
    "./node_modules/<package>/index.ts"
  ]
}
```

Commit, push, and on the other machine run `/pi-sync` then `/reload`.

## Adding a new custom extension or skill

Place it in the appropriate directory:

- `extensions/<name>/index.ts` for extensions
- `skills/<name>/SKILL.md` for skills

Commit, push, `/pi-sync` on the other machine, `/reload`.
