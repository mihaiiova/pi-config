#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source_file="$root/extensions/pi-sync/index.ts"

# The repo path must be derived from the extension's own location, never a
# hardcoded path — pi-config is cloned to different locations per machine.
grep -Fq 'fileURLToPath(import.meta.url)' "$source_file"

if grep -Fq 'PI_CONFIG_PATH' "$source_file"; then
  echo 'pi-sync must not accept an environment override for its repository path' >&2
  exit 1
fi

# No hardcoded pi-config paths may remain anywhere in the repo.
if grep -Eq 'dev/pi-config|projects/pi-config' \
  "$source_file" "$root/AGENTS.md" "$root/README.md"; then
  echo 'a hardcoded pi-config path is still present' >&2
  exit 1
fi

echo 'ok - pi-sync derives its repo path from its own location'
