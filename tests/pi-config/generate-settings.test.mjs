import assert from "node:assert/strict";
import {
  TIER_NAMES,
  DEFAULT_SUBAGENT_TIERS,
  splitModelRef,
  buildModelSettings,
  reconcileSpecBlock,
  generateSettings,
} from "../../extensions/pi-config/generate-settings.mjs";

// ── 1. Model reference splitting (first slash only) ──────────────
assert.deepEqual(splitModelRef("anthropic/claude-sonnet-4-5"), {
  provider: "anthropic",
  model: "claude-sonnet-4-5",
});
assert.deepEqual(splitModelRef("openai/gpt-5"), {
  provider: "openai",
  model: "gpt-5",
});
assert.deepEqual(splitModelRef("openrouter/x/y"), {
  provider: "openrouter",
  model: "x/y",
});
assert.deepEqual(splitModelRef("bare-model-id"), {
  provider: undefined,
  model: "bare-model-id",
});
assert.deepEqual(splitModelRef(undefined), { provider: undefined, model: undefined });
console.log("ok - model ref splits on the first slash");

// ── 2. Generation: tiers + parentTier + subagentTiers ─────────────
const config = {
  tiers: {
    high: { model: "anthropic/claude-sonnet-4-5", thinking: "high" },
    medium: { model: "openai/gpt-5", thinking: "medium" },
    small: { model: "openai/gpt-5-mini", thinking: "low" },
  },
  parentTier: "high",
  subagentTiers: {
    worker: "high",
    scout: "small",
    reviewer: "small",
    oracle: "high",
  },
};

const s = buildModelSettings(config);
assert.equal(s.defaultProvider, "anthropic");
assert.equal(s.defaultModel, "claude-sonnet-4-5");
assert.equal(s.defaultThinkingLevel, "high");
assert.deepEqual(s.subagents.agentOverrides, {
  worker: { model: "anthropic/claude-sonnet-4-5" },
  scout: { model: "openai/gpt-5-mini" },
  reviewer: { model: "openai/gpt-5-mini" },
  oracle: { model: "anthropic/claude-sonnet-4-5" },
});
console.log("ok - tiers generate default model and agent overrides");

// ── 3. Built-in subagent defaults apply when map is missing ──────
assert.deepEqual(DEFAULT_SUBAGENT_TIERS, {
  worker: "high",
  scout: "small",
  reviewer: "small",
  oracle: "high",
});
assert.deepEqual(TIER_NAMES, ["high", "medium", "small"]);

const s2 = buildModelSettings({ tiers: config.tiers, parentTier: "small" });
assert.equal(s2.defaultProvider, "openai");
assert.equal(s2.defaultModel, "gpt-5-mini");
assert.deepEqual(
  Object.keys(s2.subagents.agentOverrides).sort(),
  ["oracle", "reviewer", "scout", "worker"],
);
console.log("ok - subagent defaults route worker/oracle high, scout/reviewer small");

// Extra persisted agents beyond the built-ins are preserved, not dropped.
const extra = buildModelSettings({
  tiers: config.tiers,
  parentTier: "high",
  subagentTiers: { worker: "high", scout: "small", reviewer: "small", oracle: "high", researcher: "medium" },
});
assert.deepEqual(extra.subagents.agentOverrides.researcher, { model: "openai/gpt-5" });
assert.deepEqual(
  Object.keys(extra.subagents.agentOverrides).sort(),
  ["oracle", "researcher", "reviewer", "scout", "worker"],
);
console.log("ok - non-default subagents are preserved by generation");

// ── 4. Missing/partial config yields sensible defaults, no crash ──
assert.deepEqual(buildModelSettings(undefined), {});
assert.deepEqual(buildModelSettings({}), {});
assert.deepEqual(buildModelSettings({ parentTier: "high" }), {});

// Tiers without a parentTier still apply default subagent routing.
const noParent = buildModelSettings({ tiers: config.tiers });
assert.equal(noParent.defaultProvider, undefined);
assert.equal(noParent.defaultModel, undefined);
assert.equal(noParent.defaultThinkingLevel, undefined);
assert.deepEqual(
  Object.keys(noParent.subagents.agentOverrides).sort(),
  ["oracle", "reviewer", "scout", "worker"],
);

// A subagent referencing a missing tier is skipped, not crashed on.
const partial = buildModelSettings({
  tiers: { high: { model: "a/b", thinking: "high" } },
  parentTier: "high",
  subagentTiers: { worker: "high", scout: "small" },
});
assert.deepEqual(partial.subagents.agentOverrides, { worker: { model: "a/b" } });

// A tier without a model contributes nothing.
assert.deepEqual(
  buildModelSettings({ parentTier: "high", tiers: { high: { thinking: "high" } } }),
  {},
);
console.log("ok - missing and partial config degrades without crashing");

// ── 5. Spec block reconciliation ─────────────────────────────────
const inferred = {
  baseBranch: "development",
  releaseBranch: "main",
  tagPrefix: "v",
  versionFile: "package.json",
  checks: { test: "npm test", build: "npm run build" },
  release: { viaPullRequest: false },
};

assert.deepEqual(reconcileSpecBlock(undefined, inferred), inferred);
assert.deepEqual(reconcileSpecBlock({ baseBranch: "custom", checks: { test: "yarn test" }, junk: true }, inferred), {
  baseBranch: "custom",
  releaseBranch: "main",
  tagPrefix: "v",
  versionFile: "package.json",
  checks: { test: "yarn test", build: "npm run build" },
  release: { viaPullRequest: false },
});
assert.deepEqual(reconcileSpecBlock({}, inferred), inferred);
assert.deepEqual(reconcileSpecBlock({ junk: 1 }, undefined), {});
console.log("ok - spec block reconciles existing over inferred, dropping unknown keys");

// ── 6. Idempotency: generating from a generated result ───────────
const existing = { theme: "dark", hideThinkingBlock: true };
const once = generateSettings(config, existing, inferred);
assert.equal(once.theme, "dark");
assert.equal(once.hideThinkingBlock, true);
assert.equal(once.defaultProvider, "anthropic");
assert.equal(once.defaultModel, "claude-sonnet-4-5");
assert.equal(once.defaultThinkingLevel, "high");
assert.deepEqual(once.spec, inferred);

const twice = generateSettings(config, once, inferred);
assert.deepEqual(twice, once);
console.log("ok - generateSettings is idempotent and preserves unrelated keys");

// ── 7. generateSettings clears owned keys when config drops them ─
const cleared = generateSettings(
  {},
  {
    defaultProvider: "anthropic",
    defaultModel: "x",
    defaultThinkingLevel: "high",
    subagents: { agentOverrides: { worker: { model: "a/b" } } },
    spec: inferred,
    theme: "dark",
  },
  undefined,
);
assert.deepEqual(cleared, { spec: inferred, theme: "dark" });
console.log("ok - generateSettings clears owned model keys, keeps spec and unrelated keys");

// ── 8. decisionThreshold flows from config into spec ───────────
const thresholdInferred = {
  baseBranch: "development",
  releaseBranch: "main",
  tagPrefix: "v",
  versionFile: "package.json",
};

// A configured threshold is emitted into settings.spec.decisionThreshold.
const withThreshold = generateSettings(
  { ...config, specDecisionThreshold: 0.6 },
  {},
  thresholdInferred,
);
assert.equal(withThreshold.spec.decisionThreshold, 0.6);

// Idempotent: applying it to its own output with the same config is stable.
const withThresholdTwice = generateSettings(
  { ...config, specDecisionThreshold: 0.6 },
  withThreshold,
  thresholdInferred,
);
assert.deepEqual(withThresholdTwice, withThreshold);

// Absent when the config does not configure it.
const noThreshold = generateSettings({}, {}, thresholdInferred);
assert.equal("decisionThreshold" in noThreshold.spec, false);

// A configured value wins over a stale existing spec value.
const changed = generateSettings(
  { specDecisionThreshold: 0.3 },
  { spec: { baseBranch: "development", decisionThreshold: 0.6 } },
  thresholdInferred,
);
assert.equal(changed.spec.decisionThreshold, 0.3);

// The key is documented in SPEC_KEYS: existing values survive reconciliation,
// and inferred values fill gaps.
assert.deepEqual(reconcileSpecBlock(undefined, { decisionThreshold: 0.6 }), {
  decisionThreshold: 0.6,
});
assert.equal(
  reconcileSpecBlock({ decisionThreshold: 0.4 }, thresholdInferred).decisionThreshold,
  0.4,
);
console.log("ok - decisionThreshold flows from config, is idempotent, and reconciles");

console.log("\nAll generate-settings tests passed.");
