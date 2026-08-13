#!/usr/bin/env bash
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${PI_REPOSITORY:?PI_REPOSITORY is required}"
: "${PI_ISSUE_NUMBER:?PI_ISSUE_NUMBER is required}"

plan="${1:?usage: apply-spec-plan.sh PLAN_JSON RESULT_MARKDOWN}"
result="${2:?usage: apply-spec-plan.sh PLAN_JSON RESULT_MARKDOWN}"

if jq -e '
  type == "object" and
  (.blocked | type == "string" and length > 0)
' "$plan" >/dev/null; then
  jq -r '.blocked' "$plan" > "$result"
  gh issue comment "$PI_ISSUE_NUMBER" --repo "$PI_REPOSITORY" --body-file "$result"
  exit 0
fi

jq -e '
  type == "object" and
  (.spec | type == "object") and
  (.spec.title | type == "string" and length > 0) and
  (.spec.body | type == "string" and length > 0) and
  ((.spec.labels // []) | type == "array" and all(.[]; type == "string")) and
  (.tickets | type == "array") and
  ((.tickets | length) == 0 or (.tickets | length) >= 2) and
  all(.tickets[];
    (.id | type == "string" and test("^[a-z0-9][a-z0-9-]*$")) and
    (.title | type == "string" and length > 0) and
    (.body | type == "string" and length > 0) and
    ((.labels // []) | type == "array" and all(.[]; type == "string")) and
    ((.blocked_by // []) | type == "array" and all(.[]; type == "string"))
  ) and
  ([.tickets[].id] | length == (unique | length))
' "$plan" >/dev/null

# Validate dependency order before any GitHub mutation. Each blocker must be a
# ticket that appeared earlier in the plan.
seen_ids='[]'
while IFS= read -r ticket; do
  ticket_id="$(jq -r '.id' <<< "$ticket")"
  if ! jq -e --argjson seen "$seen_ids" '
    all((.blocked_by // [])[]; . as $blocker | $seen | index($blocker) != null)
  ' <<< "$ticket" >/dev/null; then
    echo "Ticket '$ticket_id' has a blocker that does not appear earlier in the plan." >&2
    exit 1
  fi
  seen_ids="$(jq -c --arg id "$ticket_id" '. + [$id]' <<< "$seen_ids")"
done < <(jq -c '.tickets[]' "$plan")

create_issue() {
  local title="$1"
  local body="$2"
  local labels_json="$3"
  local args=(issue create --repo "$PI_REPOSITORY" --title "$title" --body "$body")
  local label

  while IFS= read -r label; do
    args+=(--label "$label")
  done < <(jq -r '.[]' <<< "$labels_json")

  gh "${args[@]}"
}

marker_for() {
  local kind="$1"
  local id="${2:-}"

  if [[ -n "$id" ]]; then
    printf '<!-- pi:create-spec:v1 source=%s#%s kind=%s id=%s -->' \
      "$PI_REPOSITORY" "$PI_ISSUE_NUMBER" "$kind" "$id"
  else
    printf '<!-- pi:create-spec:v1 source=%s#%s kind=%s -->' \
      "$PI_REPOSITORY" "$PI_ISSUE_NUMBER" "$kind"
  fi
}

find_existing_url() {
  local marker="$1"

  jq -er --arg marker "$marker" '
    [flatten[] | select((.body // "") | contains($marker)) | .html_url] |
    if length == 0 then ""
    elif length == 1 then .[0]
    else error("multiple issues contain idempotency marker: " + $marker)
    end
  ' "$issues_snapshot"
}

created="$(mktemp)"
ticket_state="$(mktemp)"
state_next="${ticket_state}.next"
issues_snapshot="$(mktemp)"
trap 'rm -f "$created" "$ticket_state" "$state_next" "$issues_snapshot"' EXIT

gh api --paginate "repos/$PI_REPOSITORY/issues?state=all&per_page=100" --slurp \
  > "$issues_snapshot"
printf '[]\n' > "$ticket_state"

spec_title="$(jq -r '.spec.title' "$plan")"
spec_marker="$(marker_for spec)"
spec_body="$(jq -r --arg parent "#$PI_ISSUE_NUMBER" \
  --arg marker "$spec_marker" \
  '.spec.body + "\n\n---\nDefinition: " + $parent + "\n\n" + $marker' "$plan")"
spec_labels="$(jq -c '.spec.labels // []' "$plan")"
spec_url="$(find_existing_url "$spec_marker")"
if [[ -z "$spec_url" ]]; then
  spec_url="$(create_issue "$spec_title" "$spec_body" "$spec_labels")"
fi
printf 'spec\t%s\t%s\n' "$spec_title" "$spec_url" > "$created"

while IFS= read -r ticket; do
  ticket_id="$(jq -r '.id' <<< "$ticket")"
  ticket_title="$(jq -r '.title' <<< "$ticket")"
  ticket_body="$(jq -r '.body' <<< "$ticket")"
  ticket_labels="$(jq -c '.labels // []' <<< "$ticket")"
  blockers="$(jq -c '.blocked_by // []' <<< "$ticket")"

  blocked_section="## Blocked by"
  if [[ "$(jq 'length' <<< "$blockers")" -eq 0 ]]; then
    blocked_section+=$'\n\nNone — can start immediately.'
  else
    while IFS= read -r blocker_id; do
      blocker_url="$(jq -er --arg id "$blocker_id" '.[] | select(.id == $id) | .url' "$ticket_state")"
      blocker_title="$(jq -er --arg id "$blocker_id" '.[] | select(.id == $id) | .title' "$ticket_state")"
      blocked_section+=$'\n\n- '
      blocked_section+="[$blocker_title]($blocker_url)"
    done < <(jq -r '.[]' <<< "$blockers")
  fi

  full_body=$(printf '## Parent\n\n[%s](%s)\n\n%s\n\n%s' \
    "$spec_title" "$spec_url" "$ticket_body" "$blocked_section")
  ticket_marker="$(marker_for ticket "$ticket_id")"
  full_body+=$'\n\n'
  full_body+="$ticket_marker"
  ticket_url="$(find_existing_url "$ticket_marker")"
  if [[ -z "$ticket_url" ]]; then
    ticket_url="$(create_issue "$ticket_title" "$full_body" "$ticket_labels")"
  fi
  jq --arg id "$ticket_id" --arg title "$ticket_title" --arg url "$ticket_url" \
    '. + [{id: $id, title: $title, url: $url}]' "$ticket_state" > "$state_next"
  mv "$state_next" "$ticket_state"
  printf 'ticket\t%s\t%s\n' "$ticket_title" "$ticket_url" >> "$created"
done < <(jq -c '.tickets[]' "$plan")

{
  echo "Prepared the implementation spec from definition #$PI_ISSUE_NUMBER:"
  echo
  printf -- '- [%s](%s)\n' "$spec_title" "$spec_url"
  if [[ "$(jq '.tickets | length' "$plan")" -gt 0 ]]; then
    echo
    echo "Implementation tickets:"
    while IFS=$'\t' read -r kind title url; do
      [[ "$kind" == "ticket" ]] && printf -- '- [%s](%s)\n' "$title" "$url"
    done < "$created"
  fi
  echo
  echo "Closing the definition issue now that the linked implementation work is ready."
} > "$result"

gh issue comment "$PI_ISSUE_NUMBER" --repo "$PI_REPOSITORY" --body-file "$result"
gh issue close "$PI_ISSUE_NUMBER" --repo "$PI_REPOSITORY" --reason completed
