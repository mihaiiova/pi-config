#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source_file="$root/extensions/pi-sync/index.ts"
git_source_file="$root/extensions/pi-sync/git-sync.mjs"

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

node "$root/tests/pi-sync/git-sync.test.mjs"

# Tool mode must call the clean-only sync boundary and report dirty entries.
grep -Fq 'const gs = gitClient.syncClean();' "$source_file"
grep -Fq 'sync refused because pi-config has local changes' "$source_file"
grep -Fq 'isError: true' "$source_file"

# TUI mode may commit only after an explicit confirmation showing dirty files.
grep -Fq 'await ctx.ui.confirm(' "$source_file"
grep -Fq 'Commit all listed changes and sync?' "$source_file"
grep -Fq 'gitClient.commitAllChanges()' "$source_file"

# The previous silent commit behavior must not return.
if grep -Eqi 'auto-commit|auto-committed' "$source_file" "$git_source_file"; then
  echo 'pi-sync still contains an automatic commit path' >&2
  exit 1
fi

# Every npm package in pi.packages must have an exact version.
node --input-type=module - "$root/package.json" <<'NODE'
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(process.argv[2], "utf-8"));
for (const spec of manifest.pi.packages) {
  assert.match(
    spec,
    /^npm:(?:@[^/]+\/)?[^@/]+@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
    `floating or invalid npm package spec: ${spec}`,
  );
}
console.log("ok - all pi npm package specs are pinned");
NODE

echo 'ok - pi-sync derives its repo path from its own location'
