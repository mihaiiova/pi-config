#!/usr/bin/env bash
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${PI_REPOSITORY:?PI_REPOSITORY is required}"
: "${PI_ISSUE_NUMBER:?PI_ISSUE_NUMBER is required}"

output="${1:?usage: fetch-thread.sh OUTPUT_FILE}"
issue_json="$(mktemp)"
comments_json="$(mktemp)"
labels_json="$(mktemp)"
trap 'rm -f "$issue_json" "$comments_json" "$labels_json"' EXIT

gh api "repos/$PI_REPOSITORY/issues/$PI_ISSUE_NUMBER" > "$issue_json"
gh api --paginate "repos/$PI_REPOSITORY/issues/$PI_ISSUE_NUMBER/comments?per_page=100" \
  --slurp > "$comments_json"
gh api --paginate "repos/$PI_REPOSITORY/labels?per_page=100" --slurp > "$labels_json"

jq -r '
  "# Issue #\(.number): \(.title)\n\n" +
  "- Repository: `" + $repo + "`\n" +
  "- State: " + .state + "\n" +
  "- Author: @" + .user.login + "\n" +
  "- URL: " + .html_url + "\n" +
  "- Labels: " + ([.labels[].name] | join(", ")) + "\n\n" +
  "## Issue body\n\n" + (.body // "_(empty)_") + "\n"
' --arg repo "$PI_REPOSITORY" "$issue_json" > "$output"

jq -r '
  flatten[] |
  "\n## Comment by @" + .user.login + " at " + .created_at + "\n\n" +
  (.body // "_(empty)_") + "\n"
' "$comments_json" >> "$output"

jq -r '
  "\n## Available repository labels\n\n" +
  ((flatten | map("- `" + .name + "`" + (if (.description // "") == "" then "" else " — " + .description end))) | join("\n")) +
  "\n"
' "$labels_json" >> "$output"
