---
name: spec-review
description: Verify a completed implementation of one spec. Run project checks, code-review and review-session, verify acceptance criteria, and transition to reviewed only when there are no blockers.
---

# Review spec

Verify the implementation on the current spec branch and mark it reviewed only when nothing blocks. This operates on one implementation spec (normal spec or epic child), never an epic container.

## Process

1. **Confirm target and work.** Refuse `spec:epic`. The target should be `spec:in-progress` (or clearly be a resumed in-progress implementation) and have commits or working-tree changes on `spec/<id>-<slug>`. If there is nothing to review, stop.

   **Run in a fresh session.** Everything needed — branch, diff, spec — is recoverable from git and the spec issue, so do not rely on conversation history. If this session carried the implementation work, ask the user to run `/new` and then `/spec-review` before proceeding. In a fresh session, derive the target from the checked-out branch (`git branch --show-current` → `spec/<id>-<slug>` → issue `<id>`) and the diff from `git diff <base>...HEAD`.

2. **Run verification.** Use the shared `scripts/spec/run-checks.sh` runner from the product repository root; it runs every check, captures each full combined stdout/stderr log, and emits compact status only. When `.pi/settings.json` has `spec.checks`, run its exact commands:

   ```bash
   <pi-config>/scripts/spec/run-checks.sh --settings .pi/settings.json
   ```

   Otherwise, discover the project's narrowest relevant tests, typecheck, lint, build, and static analysis commands and pass them explicitly (do not create or change product scripts during review merely to make verification pass):

   ```bash
   <pi-config>/scripts/spec/run-checks.sh \
     --check test='npm test' \
     --check lint='npm run lint' \
     --check build='npm run build'
   ```

   The runner prints `PASS <name>` without successful logs. For failures it prints `FAIL <name>`, a final ~40-line excerpt, and the durable full-log path under `.pi/artifacts/spec-review/`; inspect the full log only when the excerpt is insufficient. It continues through all checks and exits nonzero if any fail. Record pass/fail and any command that cannot run. Project-owned commands should make review-significant warnings fail where their toolchain supports it; the generic runner does not infer warning severity from arbitrary output.

3. **Run `/code-review`.** Review the diff between the development base branch and the spec branch. Treat the spec issue as the spec source. Pass the step-2 verification results to `/code-review` so validation is not re-run. Capture Standards findings, Spec findings, and the acceptance-criteria matrix.

4. **Resolve blockers.** Fix documented-standard violations and spec gaps that belong to the agreed scope. Treat heuristic smells as judgement calls; fix them only when they improve the change without scope creep. Re-run affected checks.

5. **Run `/review-session`.** Reflect on the development round and implement only improvements the user accepts.

6. **Verify acceptance criteria.** Every criterion needs evidence from code/tests. A practical behavior without regression-test evidence where a test is reasonable remains partial.

7. **Produce a consolidated report.** Include verification, Standards, Spec matrix, session-review outcomes, and any blockers.

8. **Transition state.** Only with no blockers, make `spec:reviewed` the spec's sole lifecycle-state label: remove `spec:ready`, `spec:in-progress`, and `spec:done`, then apply `spec:reviewed`. If blockers remain, leave the current state unchanged and list exactly what must be resolved before `/spec-close`.
