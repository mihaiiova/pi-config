import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  diffPackages,
  fingerprintFiles,
  computeReloadSignal,
} from "../../extensions/startup-check/drift-check.mjs";

// ── 1. Package diff: missing/extras, source objects, filtering, order ──
assert.deepEqual(
  diffPackages(
    ["npm:a@1.0.0", "npm:b@2.0.0"],
    ["npm:a@1.0.0", "npm:c@3.0.0"],
  ),
  { missing: ["npm:b@2.0.0"], extras: ["npm:c@3.0.0"] },
);

assert.deepEqual(
  diffPackages(
    ["npm:a@1.0.0", "npm:b@2.0.0"],
    ["npm:a@1.0.0", { source: "npm:b@2.0.0" }],
  ),
  { missing: [], extras: [] },
);

assert.deepEqual(
  diffPackages(
    ["npm:a@1.0.0"],
    ["npm:a@1.0.0", "garbage", { source: "git:repo@1" }],
  ),
  { missing: [], extras: ["git:repo@1"] },
);

assert.deepEqual(
  diffPackages(
    ["npm:z@1", "npm:a@1", "npm:m@1"],
    ["npm:m@1"],
  ),
  { missing: ["npm:a@1", "npm:z@1"], extras: [] },
);
console.log("ok - diffPackages computes missing/extras, normalizes sources, filters non-npm, sorts");

// ── 2. Fingerprint: stable hex of sorted path:hash lines ──────────
const files = [
  { path: "b.txt", hash: "h2" },
  { path: "a.txt", hash: "h1" },
];
const expectedFingerprint = createHash("sha256")
  .update("a.txt:h1\nb.txt:h2")
  .digest("hex");

assert.equal(fingerprintFiles(files), expectedFingerprint);
assert.equal(fingerprintFiles([files[1], files[0]]), expectedFingerprint);
console.log("ok - fingerprintFiles is stable and order-independent");

// ── 3. Reload signal: null baseline, identical, changed/added/removed ──
assert.equal(computeReloadSignal(files, null), false);
assert.equal(computeReloadSignal(files, undefined), false);
assert.equal(computeReloadSignal(files, expectedFingerprint), false);
assert.equal(
  computeReloadSignal([{ path: "a.txt", hash: "changed" }], expectedFingerprint),
  true,
);
assert.equal(
  computeReloadSignal([...files, { path: "c.txt", hash: "h3" }], expectedFingerprint),
  true,
);
assert.equal(
  computeReloadSignal([{ path: "a.txt", hash: "h1" }], expectedFingerprint),
  true,
);
console.log("ok - computeReloadSignal flags changed/added/removed, ignores null baseline");
