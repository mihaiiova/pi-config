# Pi Configuration

Shared pi configuration lives in the `pi-config` repo — a git-backed pi package synced across machines. The repo has no fixed path; each machine clones it where convenient. This file is symlinked from `~/.pi/agent/AGENTS.md`.

See [README.md](README.md) for the full structure and setup guide.

## Spec lifecycle

Take work from idea to merged branch with the `/new-spec` → `/start-spec` → `/review-spec` → `/close-spec` slash commands. Each stage persists status as a GitHub label (`spec:ready`, `spec:in-progress`, `spec:reviewed`, `spec:done`). See [docs/spec-lifecycle.md](docs/spec-lifecycle.md) for the full vocabulary and branch/base-branch conventions.

## Creating new extensions or skills

Place new extensions in `<pi-config>/extensions/<name>/` and new skills in `<pi-config>/skills/<name>/`. Pi auto-discovers both. Run `/reload` to pick up new additions.

## Keeping in sync

Run `/pi-sync` from any pi session. It handles git push/pull, installs new packages from `pi.packages`, and asks about extras. Then `/reload`.

Or manually:

```bash
cd <pi-config> && git add -A && git commit -m "..." && git push
# On the other machine: /pi-sync
```
