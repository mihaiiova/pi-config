export interface Tier {
  model: string;
  thinking?: string;
}

export interface PiConfig {
  tiers: Record<string, Tier>;
  parentTier?: string;
  subagentTiers?: Record<string, string>;
}

export interface SpecFacts {
  baseBranch?: string;
  releaseBranch?: string;
  tagPrefix?: string;
  versionFile?: string;
  changelogFile?: string;
  checks?: Record<string, string>;
  release?: Record<string, unknown>;
}

export interface SplitModelRef {
  provider: string | undefined;
  model: string | undefined;
}

export const TIER_NAMES: string[];
export const DEFAULT_SUBAGENT_TIERS: Record<string, string>;

export function splitModelRef(ref: string | undefined): SplitModelRef;
export function buildModelSettings(config: PiConfig | undefined): Record<string, unknown>;
export function reconcileSpecBlock(
  existingSpec: Record<string, unknown> | undefined,
  inferred: SpecFacts | undefined,
): Record<string, unknown>;
export function generateSettings(
  config: PiConfig | undefined,
  existingSettings: Record<string, unknown> | undefined,
  inferredSpec: SpecFacts | undefined,
): Record<string, unknown>;
