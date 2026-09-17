import assert from "node:assert/strict";
import {
  deriveActiveSpec,
  parseSpecPhase,
  parseChangedFiles,
} from "../../extensions/project-state/reconcile.mjs";

// ── 1. deriveActiveSpec: spec/<n>- branches, non-spec, malformed ──
assert.deepEqual(deriveActiveSpec("spec/10-add-project-state"), { number: 10 });
assert.deepEqual(deriveActiveSpec("spec/42-some-slug"), { number: 42 });
assert.equal(deriveActiveSpec("development"), null);
assert.equal(deriveActiveSpec("feature/spec/5-x"), null); // not a prefix match
assert.equal(deriveActiveSpec("spec/x-y"), null); // no leading number
assert.equal(deriveActiveSpec("spec/0-zero"), null); // non-positive
assert.equal(deriveActiveSpec("spec/10"), null); // missing trailing `-slug`
assert.equal(deriveActiveSpec(null), null);
assert.equal(deriveActiveSpec(undefined), null);
assert.equal(deriveActiveSpec(""), null);
console.log("ok - deriveActiveSpec maps only spec/<positive-n>-<slug> branches");

// ── 2. parseSpecPhase: first spec lifecycle label wins, else null ──
assert.equal(parseSpecPhase(["spec:in-progress", "bug"]), "in-progress");
assert.equal(parseSpecPhase(["idea", "spec:reviewed"]), "reviewed");
assert.equal(parseSpecPhase(["spec:ready", "spec:done"]), "ready"); // first match
assert.equal(parseSpecPhase(["idea"]), null);
assert.equal(parseSpecPhase([]), null);
assert.equal(parseSpecPhase(null), null);
assert.equal(parseSpecPhase(undefined), null);
console.log("ok - parseSpecPhase selects the first lifecycle label and nulls otherwise");

// ── 3. parseChangedFiles: porcelain lines, rename split, trimming ──
assert.deepEqual(parseChangedFiles(" M README.md\n?? new-file.txt"), [
  "README.md",
  "new-file.txt",
]);
assert.deepEqual(parseChangedFiles("R  old-name.ts -> new-name.ts"), ["new-name.ts"]);
assert.deepEqual(parseChangedFiles("MM .pi/settings.json"), [".pi/settings.json"]);
assert.deepEqual(parseChangedFiles(""), []);
assert.deepEqual(parseChangedFiles(null), []);
assert.deepEqual(parseChangedFiles(undefined), []);
console.log("ok - parseChangedFiles splits rename targets and tolerates empty input");
