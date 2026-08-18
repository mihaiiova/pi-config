#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source_file="$root/extensions/pi-sync/index.ts"

grep -Fq 'const REPO_PATH = resolve(process.env.HOME!, "dev/pi-config");' "$source_file"

if grep -Fq 'PI_CONFIG_PATH' "$source_file"; then
  echo 'pi-sync must not accept an environment override for its repository path' >&2
  exit 1
fi

if grep -Eq '~/projects/pi-config|/home/ops/(dev|projects-old)/pi-config' \
  "$source_file" "$root/AGENTS.md" "$root/README.md"; then
  echo 'a legacy pi-config path is still present' >&2
  exit 1
fi

echo 'ok - pi-sync is fixed to $HOME/dev/pi-config'
