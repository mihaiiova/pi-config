---
name: review-spec
description: Verify a completed implementation of one spec. Run project checks, code-review and review-session, verify acceptance criteria, and transition to reviewed only when there are no blockers.
---

# Review spec

Verify the implementation on the current spec branch and mark it reviewed only when nothing blocks. This operates on one implementation spec (normal spec or epic child), never an epic container.

## Process

1. **Confirm target and work.** Refuse `spec:epic`. The target should be `spec:in-progress` (or clearly be a resumed in-progress implementation) and have commits or working-tree changes on `spec/<id>-<slug>`. If there is nothing to review, stop.

2. **Run targeted verification first.** Read `spec.verification.targeted` from `.pi/settings.json` when configured; otherwise discover the newly added and directly affected tests. Run the narrowest useful test command first for fast feedback. Record the command and outcome.

3. **Run the practical regression gate.** After targeted tests pass, run `spec.verification.regression` or the repository's full practical unit/integration suite. Then run configured or discovered typecheck, lint, build, and static-analysis commands. Do not skip the regression suite merely because targeted tests passed. Costly E2E or external-infrastructure checks may be limited to the practical smoke tier here only when the reason is recorded; the strongest configured `spec.verification.release` gate belongs to `/release`. Record every command and outcome, including why a check could not run.

4. **Run `/code-review`.** Review the diff between the configured integration branch and the spec branch. Treat the spec issue as the spec source. Capture Standards findings, Spec findings, and the acceptance-criteria matrix.

5. **Resolve blockers.** Fix documented-standard violations and spec gaps that belong to the agreed scope. Treat heuristic smells as judgement calls; fix them only when they improve the change without scope creep. Re-run affected checks, then repeat the practical regression gate and typecheck/lint/build before marking the spec reviewed.

6. **Run `/review-session`.** Reflect on the development round and implement only improvements the user accepts.

7. **Verify acceptance criteria.** Every criterion needs evidence from code/tests. A practical behavior without regression-test evidence where a test is reasonable remains partial.

8. **Produce a consolidated report.** Include targeted and regression verification separately, typecheck/lint/build outcomes, Standards, Spec matrix, session-review outcomes, and any blockers.

9. **Transition state.** Only with no blockers, make `spec:reviewed` the spec's sole lifecycle-state label: remove `spec:ready`, `spec:in-progress`, and `spec:done`, then apply `spec:reviewed`. If blockers remain, leave the current state unchanged and list exactly what must be resolved before `/close-spec`.
