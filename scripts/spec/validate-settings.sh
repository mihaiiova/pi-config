#!/usr/bin/env bash
set -euo pipefail

# Validate a .pi/settings.json for the spec lifecycle.
# Exit 0 when the file is absent (documented defaults apply) or valid;
# exit 1 with a message when malformed.
#
# Usage: validate-settings.sh [SETTINGS_PATH]

settings="${1:-.pi/settings.json}"
fail() { echo "validate-settings: $*" >&2; exit 1; }

if [[ ! -f "$settings" ]]; then
  echo "ok - no settings file ($settings); documented defaults apply"
  exit 0
fi

jq -e 'type == "object"' "$settings" >/dev/null 2>&1 || fail "root must be a JSON object"

if jq -e 'has("spec")' "$settings" >/dev/null 2>&1; then
  jq -e '
    (.spec | type == "object") and
    ((.spec.baseBranch // "") | type == "string") and
    ((.spec.releaseBranch // "") | type == "string") and
    ((.spec.tagPrefix // "v") | type == "string") and
    ((.spec.versionFile // "") | type == "string") and
    ((.spec.changelogFile // "") | type == "string") and
    ((.spec.checks // {}) | type == "object" and all(.[]; type == "string")) and
    ((.spec.release // {}) | type == "object")
  ' "$settings" >/dev/null 2>&1 \
    || fail "spec must use strings for baseBranch/releaseBranch/tagPrefix/versionFile/changelogFile, an object of string commands for checks, and an object for release"

  if jq -e '.spec | has("release")' "$settings" >/dev/null 2>&1; then
    jq -e '
      ((.spec.release.viaPullRequest // false) | type == "boolean") and
      ((.spec.release.draft // false) | type == "boolean") and
      ((.spec.release.bumpDevAfterRelease // true) | type == "boolean")
    ' "$settings" >/dev/null 2>&1 \
      || fail "spec.release must use booleans for viaPullRequest/draft/bumpDevAfterRelease"
  fi
fi

echo "ok - settings valid ($settings)"
