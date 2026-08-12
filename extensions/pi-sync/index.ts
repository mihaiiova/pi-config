/**
 * pi-sync — sync ~/dev/pi-config with GitHub
 *
 * Command: /pi-sync
 * Tool:    pi_sync (callable by LLM)
 *
 * Flow: pull → auto-commit if dirty → push
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

// ── Config ────────────────────────────────────────────────────

const REPO_PATH = resolve(process.env.HOME!, "dev/pi-config");

// ── Helpers ───────────────────────────────────────────────────

function git(args: string): { stdout: string; stderr: string } {
  const stdout = execSync(`git -C "${REPO_PATH}" ${args}`, {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return { stdout: stdout.trim(), stderr: "" };
}

function gitSafe(args: string): { stdout: string; stderr: string; ok: boolean } {
  try {
    const out = execSync(`git -C "${REPO_PATH}" ${args}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout: out.trim(), stderr: "", ok: true };
  } catch (err: any) {
    return {
      stdout: err.stdout?.trim() ?? "",
      stderr: err.stderr?.trim() ?? err.message,
      ok: false,
    };
  }
}

function isDirty(): boolean {
  const { stdout } = git("status --porcelain");
  return stdout.length > 0;
}

function hasConflicts(): boolean {
  const { stdout } = git("diff --name-only --diff-filter=U");
  return stdout.length > 0;
}

function isRebasing(): boolean {
  const { stdout } = git("rev-parse --git-path rebase-merge 2>/dev/null; git rev-parse --git-path rebase-apply 2>/dev/null");
  // If either path exists, we're in a rebase
  // Simpler approach: check status for rebase indicators
  try {
    execSync(`test -d "$(git -C "${REPO_PATH}" rev-parse --git-dir)/rebase-merge"`, { stdio: "ignore" });
    return true;
  } catch {
    try {
      execSync(`test -d "$(git -C "${REPO_PATH}" rev-parse --git-dir)/rebase-apply"`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }
}

function abortRebase(): void {
  git("rebase --abort");
}

function stageAndCommit(): string {
  git("add -A");
  git('commit -m "sync: auto-commit before pull"');
  return git("log -1 --format=%s").stdout;
}

// ── Sync logic ────────────────────────────────────────────────

interface SyncResult {
  action: string;
  detail?: string;
  error?: string;
  needsHelp?: boolean;
  conflictFiles?: string[];
}

function doSync(): SyncResult {
  const steps: string[] = [];

  // 1. Fetch first so we know what's coming
  const fetch = gitSafe("fetch --quiet");
  if (!fetch.ok) {
    return { action: "fetch failed", error: fetch.stderr };
  }

  // 2. Stash if dirty (pull first so remote changes land cleanly)
  const dirty = isDirty();
  if (dirty) {
    const msg = stageAndCommit();
    steps.push(`auto-committed: ${msg}`);
  }

  // 3. Pull with rebase
  const pull = gitSafe("pull --rebase --quiet");
  if (!pull.ok) {
    // Check if it's a conflict during rebase
    if (isRebasing() && hasConflicts()) {
      const conflictFiles = git("diff --name-only --diff-filter=U").stdout.split("\n");
      return {
        action: "merge conflict",
        detail: steps.join("; "),
        needsHelp: true,
        conflictFiles,
      };
    }
    // Some other pull error (network, auth, etc.)
    return { action: "pull failed", error: pull.stderr, detail: steps.join("; ") };
  }

  if (pull.stdout && !pull.stdout.includes("Already up to date")) {
    steps.push("pulled remote changes");
  }

  // 4. Push
  const push = gitSafe("push --quiet");
  if (!push.ok) {
    return { action: "push failed", error: push.stderr, detail: steps.join("; ") };
  }

  if (steps.length === 0) {
    steps.push("already up to date");
  }

  return { action: "synced", detail: steps.join("; ") };
}

// ── Extension ──────────────────────────────────────────────────

export default function piSync(pi: ExtensionAPI) {
  // ── Tool: pi_sync ────────────────────────────────────────

  pi.registerTool({
    name: "pi_sync",
    label: "Pi Sync",
    description:
      "Sync the pi-config repository (~/dev/pi-config) with GitHub. Pulls remote changes, auto-commits local changes, and pushes. Call when the user asks to sync their pi config across machines.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
      const result = doSync();
      if (result.needsHelp) {
        return {
          content: [
            {
              type: "text",
              text: `Merge conflict in pi-config! Conflicting files:\n${result.conflictFiles!.map((f) => `  - ${f}`).join("\n")}\n\nAsk the user to resolve conflicts manually in ~/dev/pi-config, then run /pi-sync again.`,
            },
          ],
          details: {},
          isError: true,
        };
      }
      if (result.error) {
        return {
          content: [
            {
              type: "text",
              text: `${result.action}: ${result.error}`,
            },
          ],
          details: {},
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Synced: ${result.detail}`,
          },
        ],
        details: {},
      };
    },
  });

  // ── Command: /pi-sync ────────────────────────────────────

  pi.registerCommand("pi-sync", {
    description: "Sync pi-config (~/dev/pi-config) with GitHub",
    handler: async (_args, ctx) => {
      ctx.ui.notify("Syncing pi-config…", "info");

      const result = doSync();

      if (result.needsHelp) {
        ctx.ui.notify(
          `Merge conflict! Files: ${result.conflictFiles!.join(", ")}. Resolve in ~/dev/pi-config, then re-run /pi-sync.`,
          "error",
        );
        return;
      }

      if (result.error) {
        ctx.ui.notify(`${result.action}: ${result.error}`, "error");
        return;
      }

      ctx.ui.notify(`Done: ${result.detail}`, "success");
    },
  });
}
