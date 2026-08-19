---
name: review-spec
description: Verify a completed implementation of one spec. Run tests, typecheck, lint, and build; run code-review and review-session; check acceptance criteria; produce a consolidated report; mark reviewed only when there are no blockers.
---

# Review spec

Verify the implementation on the current spec branch and mark it reviewed only when nothing blocks. This operates on an **individual implementation spec** (a normal spec or an epic child), not on the epic container.

## Process

1. **Confirm there is work to review.** There must be commits or working-tree changes on the spec branch (`spec/<id>-<slug>`). If none, stop and report.

2. **Run verification.** Discover and run the project's checks — tests, typecheck, lint, and build — using the narrowest relevant command for each. Record every command and its result. If a command cannot run, record why; do not imply it passed.

3. **Run `/code-review`.** Review the diff between the base branch and the spec branch (`/code-review --base <base>`). Treat the spec issue as the spec source. Review both axes — Standards and Spec — and capture the acceptance-criteria matrix.

4. **Fix findings.** Fix every documented-standard violation and spec gap. Evaluate heuristic smell findings and fix those that improve the change without expanding scope. Re-run the affected checks and the same verification from step 2.

5. **Run `/review-session`.** Reflect on how the round went and implement any accepted improvements.

6. **Verify acceptance criteria.** Confirm every acceptance criterion in the spec is met, with evidence from the diff or tests. A `met` behavior with no regression test where one is practical is `partial`.

7. **Produce a consolidated report.** Verification results, Standards findings, Spec findings plus the acceptance matrix, session-review improvements, and any blockers.

8. **Set status.** Only when there are **no blockers**, apply `spec:reviewed` and remove `spec:in-progress`. If blockers remain, leave the status unchanged and list exactly what must be resolved before `/close-spec`.
