/**
 * project-state reconcile — pure helpers that derive authoritative context
 *
 * Extracted from the extension entrypoint so the riskiest reconciliation logic
 * (branch → active spec, GitHub label → lifecycle phase, `git status` porcelain
 * → changed-file list) is unit-testable without a running Pi session or a real
 * git/gh checkout. The entrypoint shells out to git/gh and feeds the raw
 * results through these pure functions.
 */

const SPEC_BRANCH_RE = /^spec\/(\d+)-/;
const SPEC_PHASE_LABELS = ["spec:ready", "spec:in-progress", "spec:reviewed", "spec:done"];

/** Derive the active spec number from a `spec/<number>-<slug>` branch. */
export function deriveActiveSpec(branch) {
  const match = SPEC_BRANCH_RE.exec(branch ?? "");
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isInteger(number) && number > 0 ? { number } : null;
}

/** Pick the lifecycle phase from GitHub label names, or null when absent. */
export function parseSpecPhase(labels) {
  const label = (labels ?? []).find((l) => SPEC_PHASE_LABELS.includes(l));
  return label ? label.replace(/^spec:/, "") : null;
}

/** Parse `git status --porcelain=v1` output into a changed-file list. */
export function parseChangedFiles(porcelain) {
  const files = [];
  for (const line of (porcelain ?? "").split("\n")) {
    if (!line) continue;
    let path = line.slice(3).trim();
    const arrow = path.indexOf(" -> ");
    if (arrow !== -1) path = path.slice(arrow + 4);
    files.push(path);
  }
  return files;
}
