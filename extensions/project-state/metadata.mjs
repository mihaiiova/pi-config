/**
 * project-state metadata — reliable-only usage and version/config provenance
 *
 * Collects only facts the runtime actually exposes. Nothing here computes
 * pricing, guesses tokens, or fabricates attribution. Unavailable facts are
 * `null`.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Sum the main agent's Pi-reported usage across session entries.
 *
 * Counted: assistant messages (the main agent's own LLM turns) and
 * compaction/branch-summary generation (also main-agent work).
 *
 * Excluded: `toolResult` nested usage, which reflects embedded/sub-agent model
 * calls and cannot be attributed to the main agent reliably.
 *
 * Returns `null` when nothing reports usage. Missing numeric fields default to
 * zero rather than throwing.
 */
export function aggregateUsage(entries) {
  let total = null;
  for (const entry of entries ?? []) {
    const usage = usageOf(entry);
    if (!usage) continue;
    total ??= emptyUsage();
    total.input += num(usage.input);
    total.output += num(usage.output);
    total.cacheRead += num(usage.cacheRead);
    total.cacheWrite += num(usage.cacheWrite);
    total.totalTokens += num(usage.totalTokens);
    total.cost.input += num(usage.cost?.input);
    total.cost.output += num(usage.cost?.output);
    total.cost.cacheRead += num(usage.cost?.cacheRead);
    total.cost.cacheWrite += num(usage.cost?.cacheWrite);
    total.cost.total += num(usage.cost?.total);
  }
  return total;
}

function emptyUsage() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

function usageOf(entry) {
  if (!entry || typeof entry !== "object") return undefined;
  if (entry.type === "message" && entry.message?.role === "assistant") {
    return entry.message.usage;
  }
  if (entry.type === "compaction" || entry.type === "branch_summary") {
    return entry.usage;
  }
  return undefined;
}

function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Aggregate reliably reported per-agent (subagent) usage from the Pi session
 * directory's `subagent-artifacts/*_meta.json` files. Returns `null` when the
 * directory is absent, empty, or holds no usable metadata — never fabricates a
 * breakdown. Each agent entry carries `status` (derived from `exitCode`), the
 * actual `model`, and summed `cost` from the reliable `agent`/`usage.cost`
 * artifact fields.
 */
export function collectSubagentUsage(sessionDir) {
  if (typeof sessionDir !== "string" || !sessionDir) return null;
  const dir = join(sessionDir, "subagent-artifacts");
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return null;
  }
  const perAgent = new Map();
  for (const name of names) {
    if (!name.endsWith("_meta.json")) continue;
    let meta;
    try {
      meta = JSON.parse(readFileSync(join(dir, name), "utf-8"));
    } catch {
      continue;
    }
    const agent =
      typeof meta?.agent === "string" && meta.agent.trim()
        ? meta.agent.trim()
        : "subagent";
    const cost = num(meta?.usage?.cost);
    const entry =
      perAgent.get(agent) ?? { agent, runs: 0, cost: 0, exitCodes: [], models: [] };
    entry.runs += 1;
    entry.cost += cost;
    entry.exitCodes.push(Number.isInteger(meta?.exitCode) ? meta.exitCode : null);
    entry.models.push(
      typeof meta?.model === "string" && meta.model.trim() ? meta.model.trim() : null,
    );
    perAgent.set(agent, entry);
  }
  if (perAgent.size === 0) return null;
  const agents = Array.from(perAgent.values())
    .map(({ exitCodes, models, ...rest }) => ({
      ...rest,
      status: statusOf(exitCodes),
      model: modelOf(models),
    }))
    .sort((a, b) => (a.agent < b.agent ? -1 : a.agent > b.agent ? 1 : 0));
  let totalCost = 0;
  for (const entry of agents) totalCost += entry.cost;
  return { agents, totalCost };
}

/**
 * Derive a per-agent run status from each run's `exitCode`.
 * `completed` when every run exited 0, `failed` when any run exited non-zero,
 * and `null` when any run lacks an integer `exitCode` (null beats wrong).
 */
function statusOf(exitCodes) {
  if (exitCodes.some((code) => code === null)) return null;
  return exitCodes.some((code) => code !== 0) ? "failed" : "completed";
}

/**
 * Resolve a per-agent model from each run's reported model. Returns the model
 * when every run agrees, and `null` on disagreement or when none reports one.
 */
function modelOf(models) {
  return models.every((m) => m === models[0]) ? models[0] : null;
}

/**
 * Read the newest machine-readable check summary (`results.json`) under an
 * artifacts directory. `run-checks.sh` writes one alongside its logs.
 *
 * Returns the parsed `{ [checkName]: "passed" | "failed" }` object from the
 * newest `results.json` file (optionally restricted to files written at or
 * after `since`, an epoch-millisecond boundary), or `null` when none exists,
 * it is outside the window, or it is malformed/wrong-shaped.
 */
export function readCheckResults(artifactsRoot, { since } = {}) {
  if (typeof artifactsRoot !== "string" || !artifactsRoot) return null;
  const bound = Number.isFinite(since) ? since : null;
  const files = findResultsFiles(artifactsRoot, bound);
  if (files.length === 0) return null;
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const file of files) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(file.path, "utf-8"));
    } catch {
      continue;
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  }
  return null;
}

/** Recursively collect `results.json` paths newer than (or at) `since`. */
function findResultsFiles(dir, since, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      findResultsFiles(full, since, out);
    } else if (entry.name === "results.json") {
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (since == null || st.mtimeMs >= since) out.push({ path: full, mtimeMs: st.mtimeMs });
    }
  }
  return out;
}

/**
 * Read the product version from the project's configured version file,
 * falling back to `package.json`. Returns `null` when neither is available.
 */
export function readProductVersion(cwd, versionFile) {
  const candidates = [];
  if (typeof versionFile === "string" && versionFile) {
    candidates.push(join(cwd ?? "", versionFile));
  }
  candidates.push(join(cwd ?? "", "package.json"));
  for (const path of candidates) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf-8"));
      if (typeof parsed.version === "string" && parsed.version) return parsed.version;
    } catch {
      // Not a JSON file with a string version — try the next candidate.
    }
  }
  return null;
}

/**
 * Stable SHA-256 over the active project configuration (`pi-config.json` and
 * `settings.json`). Uses relative labels so the digest is independent of the
 * checkout path and never copies large configuration into records.
 *
 * Returns `null` when neither file exists.
 */
export function configHash(piDir) {
  const files = [
    ["pi-config.json", join(piDir ?? "", "pi-config.json")],
    ["settings.json", join(piDir ?? "", "settings.json")],
  ];
  const hash = createHash("sha256");
  let found = false;
  for (const [label, path] of files) {
    let raw;
    try {
      raw = readFileSync(path, "utf-8");
    } catch {
      continue;
    }
    found = true;
    hash.update(`${label}:${raw}\n`);
  }
  return found ? hash.digest("hex") : null;
}

/** Resolve the pi-config repository HEAD commit, or `null` when unavailable. */
export function readPiConfigCommit(piConfigRoot) {
  try {
    const out = execFileSync("git", ["-C", piConfigRoot, "rev-parse", "HEAD"], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

/**
 * Assemble the provenance block for a session record. Every field is either a
 * reliably observed fact or `null`.
 */
export function collectProvenance({
  piConfigRoot,
  cwd,
  piDir,
  versionFile,
  piVersion,
  piSessionFormatVersion,
}) {
  return {
    piConfigCommit: piConfigRoot ? readPiConfigCommit(piConfigRoot) : null,
    piVersion: piVersion ?? null,
    piSessionFormatVersion: piSessionFormatVersion ?? null,
    productVersion: cwd ? readProductVersion(cwd, versionFile) : null,
    configHash: piDir ? configHash(piDir) : null,
  };
}
