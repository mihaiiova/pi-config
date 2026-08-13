#!/usr/bin/env bash
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${PI_REPOSITORY:?PI_REPOSITORY is required}"
: "${PI_ISSUE_NUMBER:?PI_ISSUE_NUMBER is required}"

plan="${1:?usage: apply-spec-plan.sh PLAN_JSON RESULT_MARKDOWN}"
result="${2:?usage: apply-spec-plan.sh PLAN_JSON RESULT_MARKDOWN}"

if jq -e '
  type == "object" and
  (.blocked | type == "string" and length > 0) and
  ((.issues // []) | type == "array" and length == 0)
' "$plan" >/dev/null; then
  jq -r '.blocked' "$plan" > "$result"
  gh issue comment "$PI_ISSUE_NUMBER" --repo "$PI_REPOSITORY" --body-file "$result"
  exit 0
fi

jq -e '
  type == "object" and
  (.issues | type == "array" and length > 0) and
  all(.issues[];
    (.title | type == "string" and length > 0) and
    (.body | type == "string" and length > 0) and
    ((.labels // []) | type == "array" and all(.[]; type == "string"))
  )
' "$plan" >/dev/null

created="$(mktemp)"
trap 'rm -f "$created"' EXIT
: > "$created"

while IFS= read -r item; do
  title="$(jq -r .title <<< "$item")"
  body="$(jq -r --arg parent "#$PI_ISSUE_NUMBER" \
    '.body + "\n\n---\nParent definition: " + $parent' <<< "$item")"

  args=(issue create --repo "$PI_REPOSITORY" --title "$title" --body "$body")
  while IFS= read -r label; do
    args+=(--label "$label")
  done < <(jq -r '.labels // [] | .[]' <<< "$item")

  url="$(gh "${args[@]}")"
  printf '%s\t%s\n' "$title" "$url" >> "$created"
done < <(jq -c '.issues[]' "$plan")

{
  echo "Created implementation issues from #$PI_ISSUE_NUMBER:"
  echo
  while IFS=$'\t' read -r title url; do
    printf -- '- [%s](%s)\n' "$title" "$url"
  done < "$created"
  echo
  echo "Closing the definition issue now that all implementation issues were created."
} > "$result"

gh issue comment "$PI_ISSUE_NUMBER" --repo "$PI_REPOSITORY" --body-file "$result"
gh issue close "$PI_ISSUE_NUMBER" --repo "$PI_REPOSITORY" --reason completed
