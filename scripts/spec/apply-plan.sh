#!/usr/bin/env bash
set -euo pipefail

# Apply a validated /new-spec plan to GitHub.
#
# Safety properties:
#   - validates the plan before any mutation (validate-plan.sh)
#   - creates the parent (spec or epic) before any child/ticket
#   - creates children/tickets in dependency-safe (topological) order
#   - resolves stable ids to real issue URLs; the plan never hardcodes numbers
#   - idempotent: each artifact carries a hidden marker; reruns reuse it
#   - exits non-zero on any failure, so a partial run is never reported complete
#
# Labels (created on demand):
#   spec:epic   — epic container (not directly implementable)
#   spec:ready  — a normal spec, or an epic child with no open blockers

plan="${1:?usage: apply-plan.sh PLAN_JSON}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$script_dir/validate-plan.sh" "$plan" >/dev/null

: "${GH_TOKEN:?GH_TOKEN is required}"
PI_REPOSITORY="${PI_REPOSITORY:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
[[ -n "$PI_REPOSITORY" ]] || { echo "apply-plan: could not determine repository" >&2; exit 1; }

trap 'c=$?; if [[ $c -ne 0 ]]; then echo "apply-plan: failed (exit $c). Re-run /new-spec to resume — already-created issues are reused via markers." >&2; fi' ERR

kind="$(jq -r '.kind' "$plan")"

marker_for() {
  local k="$1" id="$2"
  printf '<!-- pi:new-spec:v1 repo=%s kind=%s id=%s -->' "$PI_REPOSITORY" "$k" "$id"
}

ensure_label() {
  local label="$1"
  gh label create "$label" --repo "$PI_REPOSITORY" --color BFD4F2 --description "spec lifecycle" >/dev/null 2>&1 || true
}

add_label() {
  local num="$1" label="$2"
  ensure_label "$label"
  gh issue edit "$num" --repo "$PI_REPOSITORY" --add-label "$label" >/dev/null
}

find_existing_url() {
  local marker="$1"
  local result
  result="$(gh issue list --repo "$PI_REPOSITORY" --state all --limit 1000 --json number,title,body,url \
    | jq --arg marker "$marker" '[.[] | select((.body // "") | contains($marker)) | .url]')"
  local count
  count="$(jq 'length' <<< "$result")"
  if [[ "$count" == "0" ]]; then
    printf ''
    return 0
  fi
  if [[ "$count" != "1" ]]; then
    echo "apply-plan: multiple issues contain marker: $marker" >&2
    return 1
  fi
  jq -r '.[0]' <<< "$result"
}

create_or_reuse() {
  # args: title, body_file, labels_json, marker  -> prints url
  local title="$1" body_file="$2" labels_json="$3" marker="$4"
  local existing
  existing="$(find_existing_url "$marker")"
  if [[ -n "$existing" ]]; then
    printf '%s' "$existing"
    return 0
  fi
  local args=(issue create --repo "$PI_REPOSITORY" --title "$title" --body-file "$body_file")
  local label
  while IFS= read -r label; do
    [[ -n "$label" ]] && args+=(--label "$label")
  done < <(jq -r '.[]' <<< "$labels_json")
  gh "${args[@]}"
}

num_of() { basename "$1"; }

# ── Spec ────────────────────────────────────────────────────────
if [[ "$kind" == "spec" ]]; then
  spec_id="$(jq -r '.spec.id' "$plan")"
  spec_title="$(jq -r '.spec.title' "$plan")"
  spec_labels="$(jq -c '.spec.labels // []' "$plan")"
  spec_marker="$(marker_for spec "$spec_id")"

  spec_body_file="$(mktemp)"
  jq -r --arg m "$spec_marker" '.spec.body + "\n\n" + $m' "$plan" > "$spec_body_file"
  spec_url="$(create_or_reuse "$spec_title" "$spec_body_file" "$spec_labels" "$spec_marker")"
  add_label "$(num_of "$spec_url")" "spec:ready"

  ticket_state="$(mktemp)"
  printf '[]\n' > "$ticket_state"
  while IFS= read -r ticket; do
    t_id="$(jq -r '.id' <<< "$ticket")"
    t_title="$(jq -r '.title' <<< "$ticket")"
    t_body="$(jq -r '.body' <<< "$ticket")"
    t_labels="$(jq -c '.labels // []' <<< "$ticket")"
    blockers="$(jq -c '.blocked_by // []' <<< "$ticket")"

    blocked_section="## Blocked by"
    if [[ "$(jq 'length' <<< "$blockers")" -eq 0 ]]; then
      blocked_section+=$'\n\nNone — can start immediately.'
    else
      while IFS= read -r b_id; do
        b_url="$(jq -er --arg id "$b_id" '.[] | select(.id == $id) | .url' "$ticket_state")"
        b_title="$(jq -er --arg id "$b_id" '.[] | select(.id == $id) | .title' "$ticket_state")"
        blocked_section+=$'\n\n- '
        blocked_section+="[$b_title]($b_url)"
      done < <(jq -r '.[]' <<< "$blockers")
    fi

    full_body="$(printf '## Parent\n\n[%s](%s)\n\n%s\n\n%s' "$spec_title" "$spec_url" "$t_body" "$blocked_section")"
    t_marker="$(marker_for ticket "$t_id")"
    t_body_file="$(mktemp)"
    printf '%s\n\n%s' "$full_body" "$t_marker" > "$t_body_file"
    t_url="$(create_or_reuse "$t_title" "$t_body_file" "$t_labels" "$t_marker")"
    jq --arg id "$t_id" --arg title "$t_title" --arg url "$t_url" \
      '. + [{id:$id,title:$title,url:$url}]' "$ticket_state" > "$ticket_state.next"
    mv "$ticket_state.next" "$ticket_state"
    printf 'ticket\t%s\t%s\n' "$t_title" "$t_url"
  done < <(jq -c '.tickets[]' "$plan")

  echo "spec (id=$spec_id) $spec_title -> $spec_url"

# ── Epic ────────────────────────────────────────────────────────
elif [[ "$kind" == "epic" ]]; then
  epic_id="$(jq -r '.epic.id' "$plan")"
  epic_title="$(jq -r '.epic.title' "$plan")"
  epic_labels="$(jq -c '.epic.labels // []' "$plan")"
  epic_marker="$(marker_for epic "$epic_id")"

  epic_body_file="$(mktemp)"
  jq -r --arg m "$epic_marker" '.epic.body + "\n\n" + $m' "$plan" > "$epic_body_file"
  epic_url="$(create_or_reuse "$epic_title" "$epic_body_file" "$epic_labels" "$epic_marker")"
  epic_num="$(num_of "$epic_url")"
  add_label "$epic_num" "spec:epic"

  child_state="$(mktemp)"
  child_list="$(mktemp)"
  printf '[]\n' > "$child_state"
  while IFS= read -r spec; do
    s_id="$(jq -r '.id' <<< "$spec")"
    s_title="$(jq -r '.title' <<< "$spec")"
    s_body="$(jq -r '.body' <<< "$spec")"
    s_labels="$(jq -c '.labels // []' <<< "$spec")"
    blockers="$(jq -c '.blocked_by // []' <<< "$spec")"

    blocked_section="## Blocked by"
    if [[ "$(jq 'length' <<< "$blockers")" -eq 0 ]]; then
      blocked_section+=$'\n\nNone — can start immediately.'
    else
      while IFS= read -r b_id; do
        b_url="$(jq -er --arg id "$b_id" '.[] | select(.id == $id) | .url' "$child_state")"
        b_title="$(jq -er --arg id "$b_id" '.[] | select(.id == $id) | .title' "$child_state")"
        blocked_section+=$'\n\n- '
        blocked_section+="[$b_title]($b_url)"
      done < <(jq -r '.[]' <<< "$blockers")
    fi

    full_body="$(printf '## Parent\n\n[%s](%s)\n\n%s\n\n%s' "$epic_title" "$epic_url" "$s_body" "$blocked_section")"
    s_marker="$(marker_for child "$s_id")"
    s_body_file="$(mktemp)"
    printf '%s\n\n%s' "$full_body" "$s_marker" > "$s_body_file"
    s_url="$(create_or_reuse "$s_title" "$s_body_file" "$s_labels" "$s_marker")"

    if [[ "$(jq 'length' <<< "$blockers")" -eq 0 ]]; then
      add_label "$(num_of "$s_url")" "spec:ready"
    fi

    jq --arg id "$s_id" --arg title "$s_title" --arg url "$s_url" \
      '. + [{id:$id,title:$title,url:$url}]' "$child_state" > "$child_state.next"
    mv "$child_state.next" "$child_state"
    printf '%s\t%s\n' "$s_title" "$s_url" >> "$child_list"
    printf 'child\t%s\t%s\n' "$s_title" "$s_url"
  done < <(jq -c '.specs[]' "$plan")

  # Link the epic back to every child now that their URLs are known.
  child_links=""
  while IFS=$'\t' read -r title url; do
    [[ -n "$title" ]] && child_links+="- [$title]($url)"$'\n'
  done < "$child_list"
  full_epic_body="$(jq -r '.epic.body' "$plan")"$'\n\n## Child spec issues\n\n'"$child_links"$'\n'"$epic_marker"
  epic_final_file="$(mktemp)"
  printf '%s' "$full_epic_body" > "$epic_final_file"
  gh issue edit "$epic_num" --repo "$PI_REPOSITORY" --body-file "$epic_final_file" >/dev/null

  echo "epic (id=$epic_id) $epic_title -> $epic_url"
else
  echo "apply-plan: unknown kind '$kind'" >&2
  exit 1
fi

echo "plan applied: kind=$kind"
