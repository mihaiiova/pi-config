#!/usr/bin/env bash
set -euo pipefail

# Validate a /new-spec plan (JSON) before any GitHub mutation.
#
# The plan is one of two shapes:
#
#   { "kind": "spec",
#     "spec": { "id", "title", "body", "labels" },
#     "tickets": [ { "id", "title", "body", "labels", "blocked_by" } ] }
#
#   { "kind": "epic",
#     "epic": { "id", "title", "body", "labels" },
#     "specs": [ { "id", "title", "body", "labels", "blocked_by" } ] }
#
# Stable `id` values are kebab-case strings, independent of GitHub issue
# numbers. `blocked_by` references peer ids and must list each blocker earlier
# than its dependent (topological order), which also makes cycles impossible.

plan="${1:?usage: validate-plan.sh PLAN_JSON}"

fail() { echo "validate-plan: $*" >&2; exit 1; }

[[ -f "$plan" ]] || fail "plan file not found: $plan"

kind="$(jq -r '.kind // ""' "$plan")"

is_kebab='test("^[a-z0-9][a-z0-9-]*$")'

if [[ "$kind" == "spec" ]]; then
  jq -e '
    type == "object" and
    (.spec | type == "object") and
    (.spec.id | type == "string" and '"$is_kebab"') and
    (.spec.title | type == "string" and length > 0) and
    (.spec.body | type == "string" and length > 0) and
    ((.spec.labels // []) | type == "array" and all(.[]; type == "string")) and
    (.tickets | type == "array") and
    ((.tickets | length) == 0 or (.tickets | length) >= 2) and
    all(.tickets[];
      (.id | type == "string" and '"$is_kebab"') and
      (.title | type == "string" and length > 0) and
      (.body | type == "string" and length > 0) and
      ((.labels // []) | type == "array" and all(.[]; type == "string")) and
      ((.blocked_by // []) | type == "array" and all(.[]; type == "string"))
    )
  ' "$plan" >/dev/null || fail "malformed spec plan (see schema)"

  spec_id="$(jq -r '.spec.id' "$plan")"
  ticket_ids="$(jq -r '.tickets[].id // empty' "$plan")"

  dup="$(printf '%s\n%s\n' "$spec_id" "$ticket_ids" | sort | uniq -d | tr '\n' ' ')"
  [[ -z "$dup" ]] || fail "duplicate id(s): $dup"

  seen=""
  while IFS= read -r id; do
    [[ -z "$id" ]] && continue
    blockers="$(jq -r --arg id "$id" '.tickets[] | select(.id == $id) | (.blocked_by // [])[]' "$plan")"
    for b in $blockers; do
      [[ "$b" != "$id" ]] || fail "ticket '$id' cannot depend on itself"
      grep -qxF "$b" <<< "$ticket_ids" || fail "unknown dependency '$b' referenced by '$id'"
      grep -qxF "$b" <<< "$seen" || fail "dependency '$b' of '$id' is not listed earlier (cycle or unsorted order)"
    done
    seen+="$id"$'\n'
  done <<< "$ticket_ids"

elif [[ "$kind" == "epic" ]]; then
  jq -e '
    type == "object" and
    (.epic | type == "object") and
    (.epic.id | type == "string" and '"$is_kebab"') and
    (.epic.title | type == "string" and length > 0) and
    (.epic.body | type == "string" and length > 0) and
    ((.epic.labels // []) | type == "array" and all(.[]; type == "string")) and
    (.specs | type == "array" and length >= 2) and
    all(.specs[];
      (.id | type == "string" and '"$is_kebab"') and
      (.title | type == "string" and length > 0) and
      (.body | type == "string" and length > 0) and
      ((.labels // []) | type == "array" and all(.[]; type == "string")) and
      ((.blocked_by // []) | type == "array" and all(.[]; type == "string"))
    )
  ' "$plan" >/dev/null || fail "malformed epic plan (see schema)"

  epic_id="$(jq -r '.epic.id' "$plan")"
  spec_ids="$(jq -r '.specs[].id // empty' "$plan")"

  dup="$(printf '%s\n%s\n' "$epic_id" "$spec_ids" | sort | uniq -d | tr '\n' ' ')"
  [[ -z "$dup" ]] || fail "duplicate id(s): $dup"

  seen=""
  while IFS= read -r id; do
    [[ -z "$id" ]] && continue
    blockers="$(jq -r --arg id "$id" '.specs[] | select(.id == $id) | (.blocked_by // [])[]' "$plan")"
    for b in $blockers; do
      [[ "$b" != "$id" ]] || fail "spec '$id' cannot depend on itself"
      [[ "$b" != "$epic_id" ]] || fail "spec '$id' cannot depend on the epic container"
      grep -qxF "$b" <<< "$spec_ids" || fail "unknown dependency '$b' referenced by '$id'"
      grep -qxF "$b" <<< "$seen" || fail "dependency '$b' of '$id' is not listed earlier (cycle or unsorted order)"
    done
    seen+="$id"$'\n'
  done <<< "$spec_ids"

else
  fail 'kind must be "spec" or "epic"'
fi

echo "ok - plan is valid ($kind)"
