#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
suite_dir="$(mktemp -d)"
trap 'rm -rf "$suite_dir"' EXIT
mkdir -p "$suite_dir/bin"
ln -s "$root/tests/fixtures/fake-gh" "$suite_dir/bin/gh"
export PATH="$suite_dir/bin:$PATH"

passes=0

fail() {
  echo "not ok - $*" >&2
  exit 1
}

pass() {
  passes=$((passes + 1))
  echo "ok $passes - $*"
}

assert_contains() {
  local file="$1"
  local expected="$2"
  grep -Fq -- "$expected" "$file" || fail "$file does not contain: $expected"
}

assert_not_contains() {
  local file="$1"
  local unexpected="$2"
  if grep -Fq -- "$unexpected" "$file"; then
    fail "$file unexpectedly contains: $unexpected"
  fi
}

new_case() {
  case_dir="$(mktemp -d "$suite_dir/case.XXXXXX")"
  export FAKE_GH_DIR="$case_dir/gh"
  mkdir -p "$FAKE_GH_DIR"
}

extract_authorize_step() {
  ruby -ryaml -e '
    workflow = YAML.load_file(ARGV.fetch(0), aliases: true)
    step = workflow.fetch("jobs").fetch("run").fetch("steps").find { |item| item["id"] == "command" }
    abort "authorize step missing" unless step
    puts step.fetch("run")
  ' "$root/.github/workflows/pi-agent.yml" > "$1"
}

write_event() {
  local output="$1"
  local body="$2"
  local labels_json="$3"
  local pull_request_json="${4:-null}"
  jq -n \
    --arg body "$body" \
    --argjson labels "$labels_json" \
    --argjson pull_request "$pull_request_json" \
    '{comment:{body:$body,user:{login:"maintainer"}},issue:{labels:$labels,pull_request:$pull_request}}' \
    > "$output"
}

test_authorization() {
  new_case
  auth_step="$case_dir/authorize.sh"
  extract_authorize_step "$auth_step"
  chmod +x "$auth_step"
  export GH_TOKEN=test PI_REPOSITORY=owner/repo PI_DEFINING_LABEL=agent:defining

  write_event "$case_dir/event.json" 'Please @Pi IMPLEMENT this' '[]'
  PI_EVENT_PATH="$case_dir/event.json" GITHUB_OUTPUT="$case_dir/output" "$auth_step"
  assert_contains "$case_dir/output" 'name=implement'

  write_event "$case_dir/event.json" 'Use the recommended option.' '[{"name":"agent:defining"}]'
  : > "$case_dir/output"
  PI_EVENT_PATH="$case_dir/event.json" GITHUB_OUTPUT="$case_dir/output" "$auth_step"
  assert_contains "$case_dir/output" 'name=define-spec'

  export FAKE_PERMISSION=read
  if PI_EVENT_PATH="$case_dir/event.json" GITHUB_OUTPUT="$case_dir/output" "$auth_step" 2>/dev/null; then
    fail 'read-only actor was authorized'
  fi
  unset FAKE_PERMISSION

  write_event "$case_dir/event.json" '@pi implement' '[]' '{}'
  if PI_EVENT_PATH="$case_dir/event.json" GITHUB_OUTPUT="$case_dir/output" "$auth_step" 2>/dev/null; then
    fail 'pull request comment was authorized'
  fi
  pass 'authorization routes explicit commands and labeled interview replies'
}

test_definition_labels() {
  new_case
  export GH_TOKEN=test PI_REPOSITORY=owner/repo PI_ISSUE_NUMBER=7 PI_DEFINING_LABEL=agent:defining
  export FAKE_ISSUE_JSON='{"labels":[]}' FAKE_LABEL_EXISTS=false
  printf '%s\n\nWhich option?\n' '<!-- pi:define-spec status=question -->' > "$case_dir/result.md"
  "$root/scripts/pi-github/apply-definition.sh" "$case_dir/result.md"
  assert_contains "$FAKE_GH_DIR/calls.log" '--method POST repos/owner/repo/labels'
  assert_contains "$FAKE_GH_DIR/calls.log" '--add-label agent:defining'
  assert_not_contains "$FAKE_GH_DIR/last-comment" '<!-- pi:define-spec'
  assert_contains "$FAKE_GH_DIR/last-comment" 'Which option?'

  : > "$FAKE_GH_DIR/calls.log"
  export FAKE_ISSUE_JSON='{"labels":[{"name":"agent:defining"}]}' FAKE_LABEL_EXISTS=true
  printf '%s\n\nShared understanding reached.\n' '<!-- pi:define-spec status=complete -->' > "$case_dir/result.md"
  "$root/scripts/pi-github/apply-definition.sh" "$case_dir/result.md"
  assert_contains "$FAKE_GH_DIR/calls.log" '--remove-label agent:defining'

  printf 'No marker\n' > "$case_dir/result.md"
  if "$root/scripts/pi-github/apply-definition.sh" "$case_dir/result.md" 2>/dev/null; then
    fail 'definition result without a status marker was accepted'
  fi
  pass 'definition status adds and removes the continuation label'
}

write_plan() {
  jq -n '{
    spec:{title:"Spec: V1",body:"## Problem Statement\n\nShip it",labels:[]},
    tickets:[
      {id:"slice-a",title:"Slice A",body:"First slice",labels:[],blocked_by:[]},
      {id:"slice-b",title:"Slice B",body:"Second slice",labels:[],blocked_by:["slice-a"]}
    ]
  }' > "$1"
}

test_create_spec_idempotency() {
  new_case
  export GH_TOKEN=test PI_REPOSITORY=owner/repo PI_ISSUE_NUMBER=9
  write_plan "$case_dir/plan.json"
  printf '%s\n' '[[{"html_url":"https://example.test/issues/10","body":"<!-- pi:create-spec:v1 source=owner/repo#9 kind=spec -->"},{"html_url":"https://example.test/issues/11","body":"<!-- pi:create-spec:v1 source=owner/repo#9 kind=ticket id=slice-a -->"}]]' > "$case_dir/issues.json"
  export FAKE_ISSUES_SNAPSHOT="$case_dir/issues.json"
  "$root/scripts/pi-github/apply-spec-plan.sh" "$case_dir/plan.json" "$case_dir/result.md"
  [[ "$(< "$FAKE_GH_DIR/create-count")" == 1 ]] || fail 'resume did not create exactly one missing ticket'
  assert_contains "$FAKE_GH_DIR/create-1.body" '<!-- pi:create-spec:v1 source=owner/repo#9 kind=ticket id=slice-b -->'
  assert_contains "$FAKE_GH_DIR/create-1.body" 'https://example.test/issues/11'

  new_case
  export GH_TOKEN=test PI_REPOSITORY=owner/repo PI_ISSUE_NUMBER=9
  printf '%s\n' '[[{"html_url":"https://example.test/issues/10","body":"<!-- pi:create-spec:v1 source=owner/repo#9 kind=spec -->"},{"html_url":"https://example.test/issues/11","body":"<!-- pi:create-spec:v1 source=owner/repo#9 kind=ticket id=slice-a -->"},{"html_url":"https://example.test/issues/12","body":"<!-- pi:create-spec:v1 source=owner/repo#9 kind=ticket id=slice-b -->"}]]' > "$case_dir/issues.json"
  export FAKE_ISSUES_SNAPSHOT="$case_dir/issues.json"
  write_plan "$case_dir/plan.json"
  "$root/scripts/pi-github/apply-spec-plan.sh" "$case_dir/plan.json" "$case_dir/result.md"
  [[ ! -e "$FAKE_GH_DIR/create-count" ]] || fail 'complete rerun created duplicate issues'
  assert_contains "$case_dir/result.md" 'https://example.test/issues/12'

  new_case
  export GH_TOKEN=test PI_REPOSITORY=owner/repo PI_ISSUE_NUMBER=9
  jq -n '{
    spec:{title:"Spec: invalid",body:"Invalid dependency order",labels:[]},
    tickets:[
      {id:"slice-a",title:"Slice A",body:"First",labels:[],blocked_by:["slice-b"]},
      {id:"slice-b",title:"Slice B",body:"Second",labels:[],blocked_by:[]}
    ]
  }' > "$case_dir/plan.json"
  if "$root/scripts/pi-github/apply-spec-plan.sh" "$case_dir/plan.json" "$case_dir/result.md" 2>/dev/null; then
    fail 'forward dependency was accepted'
  fi
  [[ ! -e "$FAKE_GH_DIR/calls.log" ]] || fail 'invalid plan reached GitHub mutation layer'
  pass 'create-spec validates before mutation and safely resumes reruns'
}

test_skill_composition_and_config() {
  new_case
  printf '# Issue\n' > "$case_dir/issue-thread.md"
  PI_AGENT_COMMAND=implement \
  PI_COMMAND=/bin/echo \
  PI_CONFIG_DIR="$root" \
  PI_WORK_DIR="$case_dir" \
  PI_REPOSITORY=owner/repo \
  PI_ISSUE_NUMBER=42 \
  PI_READY_LABEL=queued \
  PI_DEFINING_LABEL=agent:designing \
  PI_BRANCH_PREFIX=automation/issue- \
  PI_VERIFICATION_COMMAND='npm run verify' \
  GITHUB_SERVER_URL=https://github.com \
  GITHUB_REPOSITORY=owner/repo \
  GITHUB_RUN_ID=123 \
  "$root/scripts/pi-github/run.sh"

  result="$case_dir/result.md"
  assert_contains "$result" 'automation/issue-42'
  assert_contains "$result" 'npm run verify'
  ruby -e '
    text = File.read(ARGV.fetch(0))
    paths = %w[skills/tdd/SKILL.md skills/tdd/tests.md skills/tdd/mocking.md skills/code-review/SKILL.md skills/implement/SKILL.md]
    positions = paths.map { |path| text.index(path) or abort "missing #{path}" }
    abort "wrong implement skill order" unless positions == positions.sort
  ' "$result"
  pass 'implement receives project config and composes TDD before review'
}

test_static_contracts() {
  bash -n "$root"/scripts/pi-github/*.sh "$root/tests/pi-github/test.sh" "$root/tests/fixtures/fake-gh"
  ruby -ryaml -e '
    workflow = YAML.load_file(ARGV.fetch(0), aliases: true)
    inputs = workflow.fetch(true).fetch("workflow_call").fetch("inputs")
    %w[ready_label defining_label branch_prefix verification_command timeout_minutes].each { |name| inputs.fetch(name) }
    steps = workflow.fetch("jobs").fetch("run").fetch("steps")
    checkouts = steps.select { |step| step["uses"] == "actions/checkout@v4" }
    abort "checkout credentials persist" unless checkouts.length == 2 && checkouts.all? { |step| step.fetch("with").fetch("persist-credentials") == false }
    planning = steps.find { |step| step["id"] == "pi_planning" }
    abort "planning run is not sanitized" unless planning.fetch("run").include?("env -i")
    abort "planning step receives GH_TOKEN" if planning.fetch("env").key?("GH_TOKEN")
    apply = steps.find { |step| step["id"] == "apply" }
    abort "definition status helper is not wired" unless apply.fetch("run").include?("apply-definition.sh")
  ' "$root/.github/workflows/pi-agent.yml"
  ruby -ryaml -e '
    skill_path, agent_path, template_path = ARGV
    parts = File.read(skill_path).split("---", 3)
    abort "bad installer skill frontmatter" unless parts.length == 3
    metadata = YAML.safe_load(parts[1], permitted_classes: [], aliases: false)
    abort "wrong installer skill name" unless metadata["name"] == "install-github-workflow"
    abort "installer trigger missing" unless metadata.fetch("description").include?("install GitHub workflow")
    agent = YAML.safe_load_file(agent_path, permitted_classes: [], aliases: false)
    abort "stale installer default prompt" unless agent.dig("interface", "default_prompt").include?("$install-github-workflow")
    template = File.read(template_path)
    rendered = template
      .gsub("__PI_CONFIG_REF__", "0123456789abcdef0123456789abcdef01234567")
      .gsub("__READY_LABEL__", "ready-for-agent")
      .gsub("__VERIFICATION_COMMAND__", "npm test")
    YAML.safe_load(rendered, aliases: true)
    abort "caller ref missing" unless rendered.include?("pi-agent.yml@0123456789abcdef0123456789abcdef01234567")
    abort "definition continuation missing" unless rendered.include?("agent:defining")
  ' \
    "$root/skills/install-github-workflow/SKILL.md" \
    "$root/skills/install-github-workflow/agents/openai.yaml" \
    "$root/skills/install-github-workflow/assets/pi.yml"
  git -C "$root" diff --check
  pass 'shell, workflow, credential, and whitespace contracts are valid'
}

test_authorization
test_definition_labels
test_create_spec_idempotency
test_skill_composition_and_config
test_static_contracts

echo "1..$passes"
