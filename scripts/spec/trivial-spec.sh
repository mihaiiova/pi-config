#!/usr/bin/env bash
# Classify a spec body for /spec-start's trivial-spec heuristic.
#
# Prints "trivial" (exit 0) when the spec is a single trivial slice that
# /spec-start may implement inline; prints "worker" (exit 1) when it should
# delegate the TDD loop to the `worker` subagent.
#
# Heuristic (stable, documented):
#   - Epic containers are never trivial: a body carrying a "# Child specs"
#     heading is a planning container, not an implementation target.
#   - A well-formed spec must declare a "## User Stories" section; without one
#     the body is not clearly a single slice, so it defaults to worker.
#   - Trivial means the User Stories section lists at most one numbered story.
#
# Usage: trivial-spec.sh [SPEC_BODY_FILE]
# Reads the spec body from the file argument, or from stdin when omitted.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: trivial-spec.sh [SPEC_BODY_FILE]

Classify a spec body: "trivial" (exit 0) when it is a single trivial slice
for inline implementation; "worker" (exit 1) when spec-start should delegate
the TDD loop to the worker subagent. Reads stdin when no file is given.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

body="$(cat "${1:-/dev/stdin}")"

# Epic containers are never inline.
if grep -qE '^#{1,6}[[:space:]]*Child specs([[:space:]]|$)' <<<"$body"; then
  echo "worker"
  exit 1
fi

# A spec without a User Stories section is not a clear single slice.
if ! grep -qE '^##[[:space:]]+User Stories([[:space:]]|$)' <<<"$body"; then
  echo "worker"
  exit 1
fi

# Count story items inside the User Stories section only. Numbered (`1.`) and
# bulleted (`-`/`*`) items are both accepted; /to-spec normally numbers them.
count="$(awk '
  /^##[[:space:]]+User Stories([[:space:]]|$)/ { insec = 1; next }
  /^##[[:space:]]/ { insec = 0 }
  insec && (/^[[:space:]]*[0-9]+[.)][[:space:]]/ || /^[[:space:]]*[-*][[:space:]]/) { n++ }
  END { print n + 0 }
' <<<"$body")"

if [[ "$count" -le 1 ]]; then
  echo "trivial"
  exit 0
fi

echo "worker"
exit 1
