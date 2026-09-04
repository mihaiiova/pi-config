#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
runner="$root/scripts/spec/run-checks.sh"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

pass() { echo "ok - $1"; }
fail() { echo "not ok - $1" >&2; exit 1; }
assert_contains() { grep -qF -- "$2" "$1" || fail "missing '$2' in $1"; }
assert_not_contains() { ! grep -qF -- "$2" "$1" || fail "found '$2' in $1"; }

# Successful output stays in the log, while all checks execute.
artifacts="$work/artifacts-pass"
"$runner" --artifacts-dir "$artifacts" \
  --check unit="printf 'hidden unit output\\n'" \
  --check 'lint check=printf "hidden lint output\\n"' >"$work/pass.out"
assert_contains "$work/pass.out" "PASS unit"
assert_contains "$work/pass.out" "PASS lint check"
assert_not_contains "$work/pass.out" "hidden unit output"
assert_not_contains "$work/pass.out" "hidden lint output"
assert_contains "$artifacts/unit.log" "hidden unit output"
assert_contains "$artifacts/lint_check.log" "hidden lint output"
pass "successful logs are captured without being printed"

# Failures print only a bounded tail, preserve the exit code aggregate, and do
# not stop later checks.
artifacts="$work/artifacts-fail"
if "$runner" --artifacts-dir "$artifacts" \
  --check broken="for n in \$(seq 1 50); do echo line-\$n; done; exit 7" \
  --check later="printf later-ran > '$work/later'" >"$work/fail.out" 2>"$work/fail.err"; then
  fail "a failed check should produce a nonzero aggregate result"
fi
assert_contains "$work/fail.out" "FAIL broken (exit 7)"
assert_contains "$work/fail.out" "line-50"
! grep -qxF -- "line-1" "$work/fail.out" || fail "failure excerpt should be tail-limited"
assert_contains "$work/fail.out" "$artifacts/broken.log"
[[ -f "$work/later" ]] || fail "later checks must run after a failure"
assert_contains "$artifacts/broken.log" "line-1"
pass "failures are bounded and do not stop later checks"

# Project-specific named commands come from settings without shell re-parsing.
mkdir -p "$work/project/.pi"
cat > "$work/project/.pi/settings.json" <<'JSON'
{"spec":{"checks":{"type check":"printf settings-output","test":"printf test-output"}}}
JSON
(
  cd "$work/project"
  "$runner" --settings .pi/settings.json --artifacts-dir "$work/artifacts-settings" >"$work/settings.out"
)
assert_contains "$work/settings.out" "PASS type check"
assert_contains "$work/settings.out" "PASS test"
assert_not_contains "$work/settings.out" "settings-output"
assert_contains "$work/artifacts-settings/type_check.log" "settings-output"
pass "settings-defined checks run from the product root"

echo "All run-checks tests passed."
