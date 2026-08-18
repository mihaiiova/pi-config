---
name: code-review
description: Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes — Standards (does the code follow this repo's documented coding standards?) and Spec (does the code match what the originating issue/PRD asked for?). Runs both reviews in parallel sub-agents and reports them side by side. Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to "review since X".
---

Two-axis review of the diff between `HEAD` and a fixed point the user supplies:

- **Standards** — does the code conform to this repo's documented coding standards?
- **Spec** — does the code faithfully implement the originating issue / PRD / spec?

Both axes run as **parallel sub-agents** so they don't pollute each other's context, then this skill aggregates their findings.

The issue tracker should have been provided to you — run `/setup-matt-pocock-skills` if `docs/agents/issue-tracker.md` is missing.

## Review modes

Choose one mode explicitly. Do not describe a working-tree review as a three-dot comparison with `HEAD`: `git diff HEAD...HEAD` is always empty.

| User intent | Invocation | Primary input |
|---|---|---|
| Review current staged/uncommitted work | `/code-review --working-tree` | `git diff HEAD` and `git diff --cached HEAD` |
| Review the current branch/PR | `/code-review --base main` | `git diff main...HEAD` |
| Review a branch against another base | `/code-review --base develop` | `git diff develop...HEAD` |
| Audit the checked-out repository | `/code-review --codebase` | Repository inspection; no diff is primary |

Optional scope narrowing may be combined with a mode: `--issue <number-or-path>` selects the spec and `--files <path...>` restricts review to paths.

For bare `/code-review`, ask the user to choose: **current uncommitted work**, **branch vs a base**, **entire codebase**, or **custom ref**. For natural language, interpret “review vs HEAD” as `--working-tree`; interpret “review against main” as `--base main`; ask for a base when it cannot be determined.

## Process

### 1. Pin the review scope

For `--working-tree`, record the exact commands `git diff HEAD` and `git diff --cached HEAD`; require that at least one is non-empty. Do not require a fixed point.

For `--base <ref>` (or a user-supplied commit/tag/branch), resolve the base with `git rev-parse <ref>`, capture `git diff <ref>...HEAD`, and list commits with `git log <ref>..HEAD --oneline`. Require a non-empty diff.

For `--codebase`, record the checked-out commit with `git rev-parse HEAD` and the working-tree status. There is no diff precondition; reviewers inspect the repository as it exists.

A bad ref, empty selected diff, or invalid mode should fail here — not inside two parallel sub-agents.

### 2. Identify the spec source

Look for the originating spec, in this order:

1. Issue references in the commit messages (`#123`, `Closes #45`, GitLab `!67`, etc.) — fetch via the workflow in `docs/agents/issue-tracker.md`.
2. A path the user passed as an argument.
3. A PRD/spec file under `docs/`, `specs/`, or `.scratch/` matching the branch name or feature.
4. If nothing is found, ask the user where the spec is. If they say there isn't one, the **Spec** sub-agent will skip and report "no spec available".

### 3. Build an acceptance-criteria matrix

When a spec is available, extract each independently testable requirement into a matrix before delegation. Preserve the requirement wording and assign a stable identifier if the spec has none.

| Requirement | Evidence in diff | Status |
|---|---|---|
| `<quoted requirement>` | `<file:hunk, test, or none>` | `met`, `partial`, `missing`, or `not applicable` |

The Spec reviewer must validate and return this matrix. Evidence must name a changed file/hunk or a test; a claim without evidence is `partial`, not `met`. For a `met` behavior with no regression test where one is practical, mark it `partial` and explain the coverage gap. Do not fabricate requirements that are not in the selected spec.

### 4. Identify the standards sources

Anything in the repo that documents how code should be written, such as `CODING_STANDARDS.md` or `CONTRIBUTING.md`.

On top of whatever the repo documents, the Standards axis always carries the **smell baseline** below — a fixed set of Fowler code smells (_Refactoring_, ch.3) that applies even when a repo documents nothing. Two rules bind it:

- **The repo overrides.** A documented repo standard always wins; where it endorses something the baseline would flag, suppress the smell.
- **Always a judgement call.** Each smell is a labelled heuristic ("possible Feature Envy"), never a hard violation — and, like any standard here, skip anything tooling already enforces.

Each smell reads *what it is* → *how to fix*; match it against the diff:

- **Mysterious Name** — a function, variable, or type whose name doesn't reveal what it does or holds. → rename it; if no honest name comes, the design's murky.
- **Duplicated Code** — the same logic shape appears in more than one hunk or file in the change. → extract the shared shape, call it from both.
- **Feature Envy** — a method that reaches into another object's data more than its own. → move the method onto the data it envies.
- **Data Clumps** — the same few fields or params keep travelling together (a type wanting to be born). → bundle them into one type, pass that.
- **Primitive Obsession** — a primitive or string standing in for a domain concept that deserves its own type. → give the concept its own small type.
- **Repeated Switches** — the same `switch`/`if`-cascade on the same type recurs across the change. → replace with polymorphism, or one map both sites share.
- **Shotgun Surgery** — one logical change forces scattered edits across many files in the diff. → gather what changes together into one module.
- **Divergent Change** — one file or module is edited for several unrelated reasons. → split so each module changes for one reason.
- **Speculative Generality** — abstraction, parameters, or hooks added for needs the spec doesn't have. → delete it; inline back until a real need shows.
- **Message Chains** — long `a.b().c().d()` navigation the caller shouldn't depend on. → hide the walk behind one method on the first object.
- **Middle Man** — a class or function that mostly just delegates onward. → cut it, call the real target direct.
- **Refused Bequest** — a subclass or implementer that ignores or overrides most of what it inherits. → drop the inheritance, use composition.

### 5. Gather validation evidence

Before delegation, run the smallest relevant non-destructive validation commands for the selected scope when practical (for example, targeted tests, typecheck, lint, or build). Record each command and its outcome. If validation cannot run, record why; do not imply that it passed.

Reviewers assess code and coverage gaps, but validation output is evidence, not a substitute for review.

### 6. Build a self-contained review packet

Do not give reviewers only shell commands. Some reviewer environments cannot run Git or shell commands.

Before spawning reviewers, assemble a packet containing:

- selected review mode and resolved base/HEAD commit(s);
- exact diff command(s), changed-file list, and diff stat;
- commit list when applicable;
- the relevant patch hunks (or a readable patch artifact and its path);
- the spec text or path; and
- standards-source paths plus the smell baseline; and
- validation commands, outcomes, and any known limitations.

For a large diff, split the patch by subsystem and give each reviewer only the subsystem-relevant hunks, while still including the complete changed-file list. State explicitly when a reviewer receives a subset. If the packet cannot fit inline, save it to a readable artifact and provide the artifact path; verify the target reviewer can read it before launching.

### 7. Spawn both sub-agents in parallel

Send a single message with two `Agent` tool calls. Use the `general-purpose` subagent for both.

**Standards sub-agent prompt** — include:

- The self-contained review packet: selected mode, resolved refs, exact diff command(s), changed-file list/stat, commit list when applicable, and relevant patch hunks or an accessible patch artifact. For `--codebase`, provide the checked-out commit and requested audit scope.
- The list of standards-source files found in step 4, **plus the smell baseline from step 4** pasted in full — the sub-agent has no other access to it.
- The brief: "Report — per file/hunk where relevant — (a) every place the diff violates a documented standard: cite the standard (file + the rule); and (b) any baseline smell you spot: name it and quote the hunk. Distinguish hard violations from judgement calls — documented-standard breaches can be hard, but baseline smells are always judgement calls, and a documented repo standard overrides the baseline. Skip anything tooling enforces. Under 400 words."

**Spec sub-agent prompt** — include:

- The self-contained review packet: selected mode, resolved refs, exact diff command(s), changed-file list/stat, commit list when applicable, and relevant patch hunks or an accessible patch artifact. For `--codebase`, provide the checked-out commit and requested audit scope.
- The path or fetched contents of the spec and the parent-built acceptance-criteria matrix.
- The brief: "Return the acceptance-criteria matrix with evidence and status first. Then report: (a) requirements the spec asked for that are missing or partial; (b) behaviour in the diff that wasn't asked for (scope creep); (c) requirements that look implemented but where the implementation looks wrong. Quote the spec line for each finding. A practical behavior without regression-test evidence is partial. Under 400 words."

If the spec is missing, skip the Spec sub-agent and note this in the final report.

### 8. Handle incomplete reviewer results

A timed-out, tool-blocked, missing, or materially partial reviewer result is **not** a clean review. Mark that axis `incomplete` and state why.

Make one fallback attempt using a smaller, focused packet limited to the changed subsystem or unresolved acceptance criteria. If the fallback also cannot complete, preserve any valid partial findings but list exactly what was not reviewed (files, requirements, or standards). Never report `0 findings` for an incomplete axis.

### 9. Aggregate

Present the two reports under `## Standards` and `## Spec` headings, verbatim or lightly cleaned. Include the Spec acceptance-criteria matrix under `## Spec`. For an incomplete axis, label its heading `incomplete` and include the failure reason plus remaining unreviewed scope. Do **not** merge or rerank findings — the two axes are deliberately separate (see _Why two axes_).

End with a one-line summary: total findings per axis, and the worst issue _within each axis_ (if any). Don't pick a single winner across axes — that's the reranking the separation exists to prevent.

## Why two axes

A change can pass one axis and fail the other:

- Code that follows every standard but implements the wrong thing → **Standards pass, Spec fail.**
- Code that does exactly what the issue asked but breaks the project's conventions → **Spec pass, Standards fail.**

Reporting them separately stops one axis from masking the other.
