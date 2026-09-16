#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source_file="$root/extensions/startup-check/index.ts"

pass() { echo "ok - $1"; }
fail() { echo "not ok - $1" >&2; exit 1; }

# ── Source layout / safety assertions ────────────────────────────

# Repo root must be derived from the extension's own location, never a
# hardcoded path — pi-config is cloned to different locations per machine.
grep -Fq 'fileURLToPath(import.meta.url)' "$source_file"

# The drift check is a session_start handler that only emits notifications.
grep -Fq 'pi.on("session_start"' "$source_file"
grep -Fq 'ctx.ui.notify(' "$source_file"

# Offline detection must honor both environment switches.
grep -Fq 'PI_OFFLINE' "$source_file"
grep -Fq 'PI_SKIP_VERSION_CHECK' "$source_file"

# Remote drift must compare against the current branch's remote counterpart
# (origin/<branch>), never the default branch via origin/HEAD.
grep -Fq -- '--abbrev-ref' "$source_file"

# Non-blocking: never prompt or select.
if grep -Fq 'ctx.ui.confirm' "$source_file"; then
  fail "startup-check must not call ctx.ui.confirm"
fi
if grep -Fq 'ctx.ui.select' "$source_file"; then
  fail "startup-check must not call ctx.ui.select"
fi
pass "startup-check only notifies, never prompts"

# package.json must carry a top-level semver version.
node --input-type=module - "$root/package.json" <<'NODE'
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(process.argv[2], "utf-8"));
assert.match(
  manifest.version,
  /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/,
  "package.json is missing a top-level semver version",
);
console.log("ok - package.json has a top-level semver version");
NODE

# ── Unit tests: package diff, fingerprinting, reload signal, verdict ──
node "$root/tests/startup-check/drift-check.test.mjs"

echo
echo "All startup-check tests passed."
