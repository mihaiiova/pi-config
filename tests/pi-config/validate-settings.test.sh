#!/usr/bin/env bash
set -euo pipefail

# Unit tests for scripts/spec/validate-settings.sh — decisionThreshold
# validation (a number in the inclusive range [0,1]).

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
validate="$root/scripts/spec/validate-settings.sh"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

pass() { echo "ok - $1"; }
fail() { echo "not ok - $1" >&2; exit 1; }

expect_valid() { # description settings-json
  local desc="$1" json="$2"
  printf '%s' "$json" > "$work/settings.json"
  if "$validate" "$work/settings.json" >"$work/out" 2>&1; then
    pass "$desc"
  else
    echo "--- validator output ---" >&2
    cat "$work/out" >&2
    fail "$desc (expected valid)"
  fi
}

expect_invalid() { # description settings-json
  local desc="$1" json="$2"
  printf '%s' "$json" > "$work/settings.json"
  if "$validate" "$work/settings.json" >"$work/out" 2>&1; then
    echo "--- validator output ---" >&2
    cat "$work/out" >&2
    fail "$desc (expected invalid)"
  else
    pass "$desc"
  fi
}

# ── 1. Accepts numbers in the inclusive range [0,1] ─────────────
expect_valid "accepts decisionThreshold=0 (lower bound)" '{"spec":{"decisionThreshold":0}}'
expect_valid "accepts decisionThreshold=0.6 (default)" '{"spec":{"decisionThreshold":0.6}}'
expect_valid "accepts decisionThreshold=1 (upper bound)" '{"spec":{"decisionThreshold":1}}'

# ── 2. Absent decisionThreshold uses the documented default ──────
expect_valid "accepts absent decisionThreshold" '{"spec":{"baseBranch":"development"}}'

# ── 3. Rejects out-of-range numbers ─────────────────────────────
expect_invalid "rejects decisionThreshold=1.1" '{"spec":{"decisionThreshold":1.1}}'
expect_invalid "rejects decisionThreshold=-0.1" '{"spec":{"decisionThreshold":-0.1}}'

# ── 4. Rejects non-numbers ──────────────────────────────────────
expect_invalid "rejects string decisionThreshold" '{"spec":{"decisionThreshold":"0.6"}}'
expect_invalid "rejects word decisionThreshold" '{"spec":{"decisionThreshold":"high"}}'
expect_invalid "rejects null decisionThreshold" '{"spec":{"decisionThreshold":null}}'
expect_invalid "rejects boolean decisionThreshold" '{"spec":{"decisionThreshold":true}}'
expect_invalid "rejects array decisionThreshold" '{"spec":{"decisionThreshold":[0.6]}}'

echo
echo "All validate-settings decisionThreshold tests passed."
