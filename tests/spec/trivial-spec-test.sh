#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script="$root/scripts/spec/trivial-spec.sh"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

pass() { echo "ok - $1"; }
fail() { echo "not ok - $1" >&2; exit 1; }

expect() { # file expected
  local file="$1" expected="$2" out rc
  out="$("$script" "$file")" && rc=0 || rc=$?
  [[ "$out" == "$expected" ]] \
    || fail "expected '$expected' for $(basename "$file"), got '$out'"
  if [[ "$expected" == "trivial" ]]; then
    [[ "$rc" -eq 0 ]] || fail "trivial must exit 0"
  else
    [[ "$rc" -eq 1 ]] || fail "worker must exit 1"
  fi
}

# ── 1. Single user story → trivial (inline) ──────────────────────
cat > "$work/one-story.md" <<'MD'
## Problem Statement
The README has a typo.
## Solution
Fix the typo.
## User Stories
1. As a reader, I want the typo fixed.
## Testing Decisions
None.
MD
expect "$work/one-story.md" trivial
pass "single user story classifies as trivial"

# ── 2. Multiple user stories → worker (delegate) ────────────────
cat > "$work/many-stories.md" <<'MD'
## User Stories
1. As a developer, I want X.
2. As a developer, I want Y.
MD
expect "$work/many-stories.md" worker
pass "multiple user stories classify as worker"

# ── 3. Missing User Stories section → worker (safe default) ─────
cat > "$work/no-stories.md" <<'MD'
## Problem Statement
Change the thing.
## Solution
Do it.
MD
expect "$work/no-stories.md" worker
pass "missing User Stories section classifies as worker"

# ── 4. Epic container → worker even with a single story ─────────
cat > "$work/epic.md" <<'MD'
# Summary
Big work.
# Child specs
- foundation
- youtube
## User Stories
1. As a developer, I want the foundation.
MD
expect "$work/epic.md" worker
pass "epic container classifies as worker"

# ── 5. Reads a body from stdin ───────────────────────────────────
out="$(printf '## User Stories\n1. As a user, I want Z.\n' | "$script")"
[[ "$out" == "trivial" ]] || fail "stdin classification failed: got '$out'"
pass "reads a spec body from stdin"

# ── 6. Bulleted (not numbered) multiple stories → worker ──────
cat > "$work/bulleted-stories.md" <<'MD'
## User Stories
- As a developer, I want X.
- As a developer, I want Y.
MD
expect "$work/bulleted-stories.md" worker
pass "bulleted multiple user stories classify as worker"

echo
echo "All trivial-spec tests passed."
