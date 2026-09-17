/**
 * project-state metadata — reliable-only usage and version/config provenance
 *
 * Collects only facts the runtime actually exposes. Nothing here computes
 * pricing, guesses tokens, or fabricates attribution. Unavailable facts are
 * `null`.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
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
