/**
 * generate-settings — pure configuration generation for /pi-config
 *
 * Turns the tier source of truth (.pi/pi-config.json) into the effective
 * model/routing fragment of .pi/settings.json, and reconciles the spec block.
 * Everything here is a pure function of its inputs so it can be unit-tested
 * and is idempotent by construction.
 */

/** The three named tiers. Stable vocabulary other skills/extensions rely on. */
export const TIER_NAMES = ["high", "medium", "small"];

/** Built-in subagent → tier routing defaults. */
export const DEFAULT_SUBAGENT_TIERS = {
  worker: "high",
  scout: "small",
  reviewer: "small",
  oracle: "high",
};

/** Keys the spec lifecycle documents on the spec block. */
const SPEC_KEYS = [
  "baseBranch",
  "releaseBranch",
  "tagPrefix",
  "versionFile",
  "changelogFile",
  "checks",
  "release",
];

/** Model-default keys this module owns inside .pi/settings.json. */
const MODEL_KEYS = ["defaultProvider", "defaultModel", "defaultThinkingLevel"];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Split a `provider/model-id` reference on the FIRST slash. A bare id has no
 * provider part. Returns { provider, model } with undefined for missing parts.
 */
export function splitModelRef(ref) {
  if (typeof ref !== "string") return { provider: undefined, model: undefined };
  const idx = ref.indexOf("/");
  if (idx === -1) return { provider: undefined, model: ref };
  return { provider: ref.slice(0, idx), model: ref.slice(idx + 1) };
}

/**
 * Build the model/routing fragment of settings from a pi-config config:
 *   { defaultProvider, defaultModel, defaultThinkingLevel, subagents }
 *
 * A missing parentTier omits the default-* keys; a subagent whose tier is
 * missing (or whose tier has no model) is skipped. Never throws.
 */
export function buildModelSettings(config) {
  const cfg = isPlainObject(config) ? config : {};
  const tiers = isPlainObject(cfg.tiers) ? cfg.tiers : {};
  const parentTier = typeof cfg.parentTier === "string" ? cfg.parentTier : undefined;
  const subagentTiers = isPlainObject(cfg.subagentTiers)
    ? cfg.subagentTiers
    : DEFAULT_SUBAGENT_TIERS;

  const settings = {};

  const parent = typeof parentTier === "string" ? tiers[parentTier] : undefined;
  if (isPlainObject(parent) && typeof parent.model === "string" && parent.model) {
    const { provider, model } = splitModelRef(parent.model);
    if (provider && model) {
      settings.defaultProvider = provider;
      settings.defaultModel = model;
    }
    if (typeof parent.thinking === "string" && parent.thinking) {
      settings.defaultThinkingLevel = parent.thinking;
    }
  }

  const agentOverrides = {};
  for (const agent of Object.keys(subagentTiers).sort()) {
    const tier = tiers[subagentTiers[agent]];
    if (isPlainObject(tier) && typeof tier.model === "string" && tier.model) {
      agentOverrides[agent] = { model: tier.model };
    }
  }
  if (Object.keys(agentOverrides).length > 0) {
    settings.subagents = { agentOverrides };
  }

  return settings;
}

function mergeValue(existing, inferred) {
  // Maps (checks, release) shallow-merge: existing keys win, inferred fill gaps.
  if (isPlainObject(existing) && isPlainObject(inferred)) {
    const merged = { ...inferred };
    for (const [key, value] of Object.entries(existing)) merged[key] = value;
    return merged;
  }
  return existing !== undefined ? existing : inferred;
}

/**
 * Reconcile an existing spec block against inferred repo facts. Preserves
 * existing documented keys, fills missing ones from inferred, drops unknown
 * keys, and is idempotent.
 */
export function reconcileSpecBlock(existingSpec, inferred) {
  const existing = isPlainObject(existingSpec) ? existingSpec : {};
  const inferredObj = isPlainObject(inferred) ? inferred : {};
  const merged = {};
  for (const key of SPEC_KEYS) {
    const ev = existing[key];
    const iv = inferredObj[key];
    if (ev === undefined && iv === undefined) continue;
    merged[key] = mergeValue(ev, iv);
  }
  return merged;
}

/**
 * Generate the full effective settings: keep unrelated keys, overwrite the
 * model-default keys this module owns (clearing ones no longer produced),
 * merge the agentOverrides map, and reconcile the spec block.
 *
 * Idempotent: applying it to its own output with the same config and inferred
 * spec yields the same object (deep-equal).
 */
export function generateSettings(config, existingSettings, inferredSpec) {
  const base = isPlainObject(existingSettings) ? existingSettings : {};
  const out = { ...base };

  const modelSettings = buildModelSettings(config);
  for (const key of MODEL_KEYS) {
    if (modelSettings[key] !== undefined) out[key] = modelSettings[key];
    else delete out[key];
  }

  if (modelSettings.subagents !== undefined) {
    out.subagents = {
      ...(isPlainObject(base.subagents) ? base.subagents : {}),
      agentOverrides: modelSettings.subagents.agentOverrides,
    };
  } else if (isPlainObject(base.subagents) && "agentOverrides" in base.subagents) {
    const rest = { ...base.subagents };
    delete rest.agentOverrides;
    if (Object.keys(rest).length > 0) out.subagents = rest;
    else delete out.subagents;
  }

  const spec = reconcileSpecBlock(base.spec, inferredSpec);
  if (Object.keys(spec).length > 0) out.spec = spec;
  else delete out.spec;

  return out;
}
