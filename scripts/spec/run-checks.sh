#!/usr/bin/env bash
# Run named verification commands without streaming their normal output.
#
# Usage:
#   run-checks.sh --settings .pi/settings.json
#   run-checks.sh --check name='command' [--check name='command' ...]
#
# The commands intentionally run through bash because spec.checks is a map of
# shell command strings. Commands are never interpolated into generated shell
# source; each is passed as one argument to bash -c.
set -uo pipefail

usage() {
  cat <<'EOF'
Usage:
  run-checks.sh --settings PATH [--artifacts-dir PATH]
  run-checks.sh --check NAME=COMMAND [--check NAME=COMMAND ...] [--artifacts-dir PATH]

Run every named check, storing combined stdout/stderr in a separate log. A
successful check prints only PASS NAME. A failed check prints FAIL NAME, the
last 40 log lines, and the path to its complete log.
EOF
}

fail_usage() {
  echo "run-checks: $*" >&2
  usage >&2
  exit 2
}

settings=""
artifacts_dir=""
declare -a names=()
declare -a commands=()

add_check() {
  local name="$1" command="$2"
  [[ -n "$name" ]] || fail_usage "check name must not be empty"
  [[ "$name" != *$'\n'* && "$name" != *$'\r'* ]] \
    || fail_usage "check name contains a control character"
  [[ -n "$command" ]] || fail_usage "command for '$name' must not be empty"
  names+=("$name")
  commands+=("$command")
}

while (($#)); do
  case "$1" in
    --settings)
      (($# >= 2)) || fail_usage "--settings requires a path"
      settings="$2"
      shift 2
      ;;
    --check)
      (($# >= 2)) || fail_usage "--check requires NAME=COMMAND"
      [[ "$2" == *=* ]] || fail_usage "--check requires NAME=COMMAND"
      add_check "${2%%=*}" "${2#*=}"
      shift 2
      ;;
    --artifacts-dir)
      (($# >= 2)) || fail_usage "--artifacts-dir requires a path"
      artifacts_dir="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *) fail_usage "unknown argument: $1" ;;
  esac
done

if [[ -n "$settings" ]]; then
  [[ ${#names[@]} -eq 0 ]] || fail_usage "use either --settings or --check, not both"
  [[ -f "$settings" ]] || fail_usage "settings file not found: $settings"
  command -v jq >/dev/null 2>&1 || { echo "run-checks: jq is required for --settings" >&2; exit 2; }
  jq -e '(.spec.checks? // {}) | type == "object" and all(.[]; type == "string")' "$settings" >/dev/null \
    || fail_usage "spec.checks must be an object of string commands: $settings"
  while IFS= read -r -d '' name && IFS= read -r -d '' command; do
    add_check "$name" "$command"
  done < <(jq -j '(.spec.checks // {}) | to_entries[] | .key, "\u0000", .value, "\u0000"' "$settings")
fi

((${#names[@]})) || fail_usage "no checks supplied"

if [[ -z "$artifacts_dir" ]]; then
  artifacts_dir=".pi/artifacts/spec-review/$(date -u +%Y%m%dT%H%M%SZ)-$$"
fi
mkdir -p -- "$artifacts_dir" || { echo "run-checks: cannot create artifacts directory: $artifacts_dir" >&2; exit 2; }
artifacts_dir="$(cd "$artifacts_dir" && pwd -P)"
echo "Verification logs: $artifacts_dir"

failures=0
declare -A used_files=()
for i in "${!names[@]}"; do
  name="${names[$i]}"
  command="${commands[$i]}"
  safe_name="$(printf '%s' "$name" | tr -cs 'A-Za-z0-9._-' '_')"
  safe_name="${safe_name##_}"
  safe_name="${safe_name%%_}"
  [[ -n "$safe_name" ]] || safe_name="check"
  count="${used_files[$safe_name]:-0}"
  used_files[$safe_name]=$((count + 1))
  [[ "$count" -eq 0 ]] || safe_name+="-$count"
  log="$artifacts_dir/$safe_name.log"

  if bash -o pipefail -c "$command" -- >"$log" 2>&1; then
    printf 'PASS %s\n' "$name"
  else
    status=$?
    failures=$((failures + 1))
    printf 'FAIL %s (exit %s)\n' "$name" "$status"
    echo "--- last 40 lines: $log ---"
    tail -n 40 -- "$log" || true
    echo "--- full log: $log ---"
  fi
done

if ((failures)); then
  echo "Verification failed: $failures of ${#names[@]} checks failed. Logs: $artifacts_dir" >&2
  exit 1
fi

echo "Verification passed: ${#names[@]} checks. Logs: $artifacts_dir"
