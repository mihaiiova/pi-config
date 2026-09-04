---
name: spec-init
description: Initialize the spec lifecycle for a repository. Detect the branch model, version source, and check commands, ask only the unresolvable few, then generate and commit .pi/settings.json (and offer a CONTEXT.md seed). Idempotent and non-destructive.
---

# Initialize spec workflow

Set up a repository for the spec lifecycle by generating a committed `.pi/settings.json` that pins the facts the other `/spec-*` skills would otherwise re-derive on every run. Infer everything discoverable first; ask only what has no safe default.

## Boundaries

- Write only `.pi/settings.json` (and, if offered and accepted, a `CONTEXT.md` seed). Never edit product code, tests, or dependencies.
- Never overwrite an existing `.pi/settings.json` or `CONTEXT.md`; fill gaps and show the diff before changing anything.
- Do not create the development or production branches here — `/spec-start` and `/spec-release` still refuse to create missing branches. If a branch is missing, tell the user to create it.
- Commit the generated files so the configuration is portable across machines and agents.

## Process

1. **Gather repository facts.** Use `gh repo view` for the default branch; `git branch -a` and `git ls-remote --heads origin` for branch names; look for version manifests (`package.json`, `pubspec.yaml`, `Cargo.toml`, `pyproject.toml`, `*.csproj`); and look for check commands in `package.json` scripts, `Makefile`, `justfile`, or toolchain lockfiles.

2. **Infer defaults.**
   - `spec.baseBranch` — `development` if it exists, else the repository default.
   - `spec.releaseBranch` — `main` if it exists, else the repository default.
   - `spec.versionFile` — the detected version manifest.
   - `spec.checks` — map each detected script/tool to `test`, `typecheck`, `lint`, `build`.
   - `spec.tagPrefix` — `v`.

3. **Ask only what is unresolved.** One question at a time, recommend an answer, and wait for the user's answer before the next. Ask only when the inferred value is non-obvious: non-standard branch names, whether the production branch is protected (`release.viaPullRequest`), release as draft vs published (`release.draft`), and whether to bump the development version after release (`release.bumpDevAfterRelease`).

4. **Write `.pi/settings.json`.** Emit only keys that differ from the documented defaults or were explicitly chosen. Validate with `scripts/spec/validate-settings.sh`.

5. **Offer a `CONTEXT.md` seed.** If absent, offer to create a minimal one (stack, build/run/test commands, module map) because `/spec-new` reads it. Never overwrite an existing one.

6. **Commit.** Stage `.pi/settings.json` (and any seeded `CONTEXT.md`) with a message like `chore: initialize spec workflow`.

7. **Report.** Show the generated config, what was inferred vs asked, and any branches that still need to be created.

See `docs/spec-lifecycle.md` for the full `spec` settings schema and defaults.
