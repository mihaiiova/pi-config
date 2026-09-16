import assert from "node:assert/strict";
import { diffPackages } from "../../extensions/startup-check/drift-check.mjs";

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
