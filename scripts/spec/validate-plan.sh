#!/usr/bin/env bash
set -euo pipefail

# Validate a /new-spec plan before any GitHub mutation.
# Atomic implementation units are specs. Plans are either:
#   { "plan_id", "kind":"spec", "spec":{...} }
#   { "plan_id", "kind":"epic", "epic":{...}, "specs":[...] }

plan="${1:?usage: validate-plan.sh PLAN_JSON}"
fail() { echo "validate-plan: $*" >&2; exit 1; }

[[ -f "$plan" ]] || fail "plan file not found: $plan"

kind="$(jq -r '.kind // ""' "$plan")"
is_kebab='test("^[a-z0-9][a-z0-9-]*$")'
is_plan_id='test("^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$")'

jq -e '(.plan_id | type == "string" and '"$is_plan_id"')' "$plan" >/dev/null \
  || fail "plan_id must be an opaque collision-resistant identifier (8-128 safe characters)"

if [[ "$kind" == "spec" ]]; then
  jq -e '
    type == "object" and
    (.spec | type == "object") and
    (.spec.id | type == "string" and '"$is_kebab"') and
    (.spec.title | type == "string" and length > 0) and
    (.spec.body | type == "string" and length > 0) and
    ((.spec.labels // []) | type == "array" and all(.[]; type == "string")) and
    (has("tickets") | not)
  ' "$plan" >/dev/null || fail "malformed spec plan; tickets are not supported"

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
  ' "$plan" >/dev/null || fail "malformed epic plan"

  epic_id="$(jq -r '.epic.id' "$plan")"
  spec_ids="$(jq -r '.specs[].id' "$plan")"
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
