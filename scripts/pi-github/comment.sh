#!/usr/bin/env bash
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${PI_REPOSITORY:?PI_REPOSITORY is required}"
: "${PI_ISSUE_NUMBER:?PI_ISSUE_NUMBER is required}"

if [[ $# -ne 1 ]]; then
  echo "usage: comment.sh MESSAGE_OR_FILE" >&2
  exit 2
fi

if [[ -f "$1" ]]; then
  body="$(head -c 60000 "$1")"
else
  body="${1:0:60000}"
fi

if [[ -z "${body//[[:space:]]/}" ]]; then
  body="Pi completed the command but returned no summary."
fi

gh issue comment "$PI_ISSUE_NUMBER" --repo "$PI_REPOSITORY" --body "$body"
