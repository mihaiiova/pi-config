#!/usr/bin/env bash
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${PI_REPOSITORY:?PI_REPOSITORY is required}"
: "${PI_ISSUE_NUMBER:?PI_ISSUE_NUMBER is required}"

result="${1:?usage: apply-definition.sh RESULT_MARKDOWN}"
defining_label="${PI_DEFINING_LABEL:-agent:defining}"
question_marker='<!-- pi:define-spec status=question -->'
complete_marker='<!-- pi:define-spec status=complete -->'

question_count="$(grep -Fxc "$question_marker" "$result" || true)"
complete_count="$(grep -Fxc "$complete_marker" "$result" || true)"
if [[ $((question_count + complete_count)) -ne 1 ]]; then
  echo "Definition result must contain exactly one valid status marker." >&2
  exit 1
elif [[ "$question_count" -eq 1 ]]; then
  status="question"
else
  status="complete"
fi

visible_result="$(mktemp)"
trap 'rm -f "$visible_result"' EXIT
grep -Fvx -e "$question_marker" -e "$complete_marker" "$result" > "$visible_result" || true

issue_json="$(gh api "repos/$PI_REPOSITORY/issues/$PI_ISSUE_NUMBER")"
has_label=false
if jq -e --arg label "$defining_label" 'any(.labels[]?; .name == $label)' \
  <<< "$issue_json" >/dev/null; then
  has_label=true
fi

if [[ "$status" == "question" && "$has_label" == false ]]; then
  if ! gh api "repos/$PI_REPOSITORY/labels/$defining_label" >/dev/null 2>&1; then
    gh api --method POST "repos/$PI_REPOSITORY/labels" \
      -f name="$defining_label" \
      -f color='BFD4F2' \
      -f description='Pi definition interview in progress' >/dev/null || \
      gh api "repos/$PI_REPOSITORY/labels/$defining_label" >/dev/null
  fi
  gh issue edit "$PI_ISSUE_NUMBER" --repo "$PI_REPOSITORY" --add-label "$defining_label" >/dev/null
elif [[ "$status" == "complete" && "$has_label" == true ]]; then
  gh issue edit "$PI_ISSUE_NUMBER" --repo "$PI_REPOSITORY" --remove-label "$defining_label" >/dev/null
fi

"$(dirname "$0")/comment.sh" "$visible_result"
