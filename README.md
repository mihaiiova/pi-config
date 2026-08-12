# pi-config

Shared pi configuration package — extensions, skills, prompts, and themes synced across machines via git.

## Setup on a new machine

```bash
git clone <remote-url> ~/dev/pi-config
pi install ~/dev/pi-config
```

## Day-to-day

```bash
# After changes:
cd ~/dev/pi-config && git add -A && git commit -m "..." && git push

# On other machine to pull:
pi update --extensions
```

## Structure

```
pi-config/
├── extensions/   # TypeScript extensions
├── skills/       # Agent skills (SKILL.md)
├── prompts/      # Prompt templates (.md)
├── themes/       # Theme files (.json)
└── package.json  # Pi package manifest
```
