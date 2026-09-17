/**
 * project-state — project-local resume context and append-only session history
 *
 * Commands: /session-status, /session-history, /session-cost
 *
 * Maintains a mutable `.pi/state.json` resume projection (non-authoritative —
 * git branch state and GitHub lifecycle labels are re-derived at session
 * boundaries and win on divergence) plus write-once
 * `.pi/sessions/<filesystem-safe-id>.json` final records.
 *
 * Persistence, schema/migration, metadata, and rendering live in the pure
 * `.mjs` modules so they are unit-testable without a running Pi session.
 */

import {
  CONFIG_DIR_NAME,
  CURRENT_SESSION_VERSION,
  VERSION,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aggregateUsage, collectProvenance } from "./metadata.mjs";
import { formatCost, formatHistory, formatStatus } from "./presentation.mjs";
import { createStateDocument } from "./schema.mjs";
import {
  createSession,
  finalizeSession,
  listSessions,
  loadState,
  writeStateAtomic,
} from "./state.mjs";

// Derive the pi-config repo root from this extension's own location instead of
// a hardcoded path — pi-config is cloned to different locations per machine.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// In-memory session record mutated during the session, finalized on shutdown.
let currentSession: ReturnType<typeof createSession> | null = null;

// ── Authoritative-source reconciliation helpers ─────────────────

function gitSafe(cwd: string, args: string[]): string | null {
  try {
    return execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function currentBranch(cwd: string): string | null {
  const branch = gitSafe(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  return branch && branch !== "HEAD" ? branch : null;
}

/** Derive the active spec number from a `spec/<number>-<slug>` branch. */
function deriveActiveSpec(branch: string | null): { number: number } | null {
  const match = /^spec\/(\d+)-/.exec(branch ?? "");
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isInteger(number) && number > 0 ? { number } : null;
}

/** Read the authoritative lifecycle phase from GitHub labels, best-effort. */
function readGhSpecPhase(number: number, cwd: string): string | null {
  try {
    const out = execFileSync(
      "gh",
      ["issue", "view", String(number), "--json", "labels", "--jq", ".labels[].name"],
      { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    )
      .trim()
      .split("\n")
      .filter(Boolean);
    const label = out.find((l) =>
      ["spec:ready", "spec:in-progress", "spec:reviewed", "spec:done"].includes(l),
    );
    return label ? label.replace(/^spec:/, "") : null;
  } catch {
    return null;
  }
}

function readJsonFile(path: string): Record<string, any> | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, any>;
  } catch {
    return null;
  }
}

function readChecks(piDir: string): Record<string, string> | null {
  const settings = readJsonFile(join(piDir, "settings.json"));
  const checks = settings?.spec?.checks;
  return checks && typeof checks === "object" ? checks : null;
}

function readVersionFile(piDir: string): string | undefined {
  const settings = readJsonFile(join(piDir, "settings.json"));
  const versionFile = settings?.spec?.versionFile;
  return typeof versionFile === "string" ? versionFile : undefined;
}

function readSubagentModels(piDir: string): Record<string, unknown> | null {
  const settings = readJsonFile(join(piDir, "settings.json"));
  const overrides = settings?.subagents?.agentOverrides;
  return overrides && typeof overrides === "object" ? overrides : null;
}

function changedFiles(cwd: string): string[] {
  const out = gitSafe(cwd, ["status", "--porcelain=v1"]);
  if (out == null) return [];
  const files: string[] = [];
  for (const line of out.split("\n")) {
    if (!line) continue;
    let path = line.slice(3).trim();
    const arrow = path.indexOf(" -> ");
    if (arrow !== -1) path = path.slice(arrow + 4);
    files.push(path);
  }
  return files;
}

/** Load state without throwing: malformed/unsupported files read as missing. */
function loadStateSafe(piDir: string) {
  try {
    return loadState(piDir);
  } catch {
    return undefined;
  }
}

function activeModel(ctx: ExtensionContext) {
  if (!ctx.model) return null;
  return {
    provider: ctx.model.provider,
    model: ctx.model.id,
    thinkingLevel: ctx.thinkingLevel ?? null,
  };
}

function liveUsage(ctx: ExtensionContext) {
  try {
    return aggregateUsage(ctx.sessionManager.getEntries());
  } catch {
    return null;
  }
}

// ── Extension ──────────────────────────────────────────────────

export default function projectState(pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    const piDir = join(ctx.cwd, CONFIG_DIR_NAME);
    try {
      const branch = currentBranch(ctx.cwd);
      const activeSpec = deriveActiveSpec(branch);
      const phase = activeSpec ? readGhSpecPhase(activeSpec.number, ctx.cwd) : null;

      const previous = loadStateSafe(piDir);
      writeStateAtomic(
        piDir,
        createStateDocument({
          activeSpec,
          phase,
          branch,
          checks: readChecks(piDir),
          lastSessionId: previous?.lastSessionId ?? null,
        }),
      );

      currentSession = createSession({
        sessionId: ctx.sessionManager.getSessionId(),
        cwd: ctx.cwd,
        piSessionFile: ctx.sessionManager.getSessionFile(),
      });
      currentSession.branch = branch;
      currentSession.activeSpec = activeSpec;
      currentSession.phase = phase;
      currentSession.subagentModels = readSubagentModels(piDir);
      currentSession.provenance = collectProvenance({
        piConfigRoot: REPO_ROOT,
        cwd: ctx.cwd,
        piDir,
        versionFile: readVersionFile(piDir),
        piVersion: VERSION,
        piSessionFormatVersion: CURRENT_SESSION_VERSION,
      });
    } catch {
      // session_start must never throw.
    }
  });

  pi.on("session_shutdown", (event, ctx) => {
    const piDir = join(ctx.cwd, CONFIG_DIR_NAME);
    try {
      if (event.reason === "reload") {
        // The same session continues under a fresh extension instance: keep
        // the projection current without finalizing (which would be premature).
        writeStateAtomic(
          piDir,
          createStateDocument({
            activeSpec: currentSession?.activeSpec ?? null,
            phase: currentSession?.phase ?? null,
            branch: currentSession?.branch ?? null,
            checks: readChecks(piDir),
            lastSessionId: loadStateSafe(piDir)?.lastSessionId ?? null,
          }),
        );
        return;
      }

      if (currentSession) {
        currentSession.usage = aggregateUsage(ctx.sessionManager.getEntries());
        currentSession.model = activeModel(ctx);
        currentSession.changedFiles = changedFiles(ctx.cwd);
        currentSession.finalizedAt = new Date().toISOString();
        finalizeSession(piDir, currentSession);

        writeStateAtomic(
          piDir,
          createStateDocument({
            activeSpec: currentSession.activeSpec,
            phase: currentSession.phase,
            branch: currentSession.branch,
            checks: readChecks(piDir),
            lastSessionId: currentSession.sessionId,
          }),
        );
      }
    } catch {
      // session_shutdown must never throw.
    } finally {
      currentSession = null;
    }
  });

  pi.on("session_before_compact", (_event, ctx) => {
    const piDir = join(ctx.cwd, CONFIG_DIR_NAME);
    try {
      // Persist a minimal projection before compaction so resume context is
      // available even if the process dies mid-compaction.
      writeStateAtomic(
        piDir,
        createStateDocument({
          activeSpec: currentSession?.activeSpec ?? null,
          phase: currentSession?.phase ?? null,
          branch: currentSession?.branch ?? null,
          checks: readChecks(piDir),
          lastSessionId: loadStateSafe(piDir)?.lastSessionId ?? null,
        }),
      );
    } catch {
      // session_before_compact must never throw.
    }
  });

  pi.registerCommand("session-status", {
    description: "Show the current project resume projection and session cost",
    handler: async (_args, ctx) => {
      try {
        const piDir = join(ctx.cwd, CONFIG_DIR_NAME);
        const state = loadStateSafe(piDir);
        ctx.ui.notify(formatStatus(state, liveUsage(ctx)), "info");
      } catch (err) {
        ctx.ui.notify(`/session-status failed: ${(err as Error).message}`, "error");
      }
    },
  });

  pi.registerCommand("session-history", {
    description: "Show recent finalized project session records",
    handler: async (_args, ctx) => {
      try {
        const records = listSessions(join(ctx.cwd, CONFIG_DIR_NAME), { limit: 10 });
        ctx.ui.notify(formatHistory(records, { limit: 10 }), "info");
      } catch (err) {
        ctx.ui.notify(`/session-history failed: ${(err as Error).message}`, "error");
      }
    },
  });

  pi.registerCommand("session-cost", {
    description: "Show current, recent, and aggregate known session cost",
    handler: async (_args, ctx) => {
      try {
        const piDir = join(ctx.cwd, CONFIG_DIR_NAME);
        const records = listSessions(piDir);
        ctx.ui.notify(formatCost(liveUsage(ctx), records, { limit: 10 }), "info");
      } catch (err) {
        ctx.ui.notify(`/session-cost failed: ${(err as Error).message}`, "error");
      }
    },
  });
}
