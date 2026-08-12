# Pi Configuration

Shared pi configuration lives in `~/dev/pi-config/` — a git-backed pi package synced across machines. This file is symlinked from `~/.pi/agent/AGENTS.md`.

See [README.md](README.md) for the full structure and setup guide.

## Creating new extensions or skills

Place new extensions in `~/dev/pi-config/extensions/<name>/` and new skills in `~/dev/pi-config/skills/<name>/`. Pi auto-discovers both. Run `/reload` to pick up new additions.

## Keeping in sync

Run `/pi-sync` from any pi session. It handles git push/pull, installs new packages from `pi.packages`, and asks about extras. Then `/reload`.

Or manually:

```bash
cd ~/dev/pi-config && git add -A && git commit -m "..." && git push
# On the other machine: /pi-sync
```
