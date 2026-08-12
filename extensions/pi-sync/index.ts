/**
 * pi-sync — sync ~/dev/pi-config with GitHub
 *
 * Command: /pi-sync
 * Tool:    pi_sync (callable by LLM)
 *
 * Flow: fetch → auto-commit if dirty → pull --rebase → push → npm install
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

// ── Config ────────────────────────────────────────────────────

const REPO_PATH = resolve(process.env.HOME!, "dev/pi-config");

// ── Git helpers ────────────────────────────────────────────────

function git(args: string): string {
  return execSync(`git -C "${REPO_PATH}" ${args}`, {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
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
  return git("status --porcelain").length > 0;
}

function hasConflicts(): boolean {
  return git("diff --name-only --diff-filter=U").length > 0;
}

function isRebasing(): boolean {
  try {
    execSync(
      `test -d "$(git -C "${REPO_PATH}" rev-parse --git-dir)/rebase-merge"`,
      { stdio: "ignore" },
    );
    return true;
  } catch {
    try {
      execSync(
        `test -d "$(git -C "${REPO_PATH}" rev-parse --git-dir)/rebase-apply"`,
        { stdio: "ignore" },
      );
      return true;
    } catch {
      return false;
    }
  }
}

function stageAndCommit(): string {
  git("add -A");
  git('commit -m "sync: auto-commit before pull"');
  return git("log -1 --format=%s");
}

// ── npm helper ─────────────────────────────────────────────────

function npmInstall(): { ok: boolean; output: string } {
  try {
    const out = execSync(`npm install`, {
      cwd: REPO_PATH,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { ok: true, output: out.trim() };
  } catch (err: any) {
    const msg = err.stderr?.trim() || err.stdout?.trim() || err.message;
    return { ok: false, output: msg };
  }
}

// ── Sync logic ────────────────────────────────────────────────

interface SyncResult {
  steps: string[];
  error?: string;
  needsHelp?: boolean;
  conflictFiles?: string[];
}

function doSync(): SyncResult {
  const steps: string[] = [];

  // 1. Fetch
  const fetch = gitSafe("fetch --quiet");
  if (!fetch.ok) {
    return { steps, error: `fetch failed: ${fetch.stderr}` };
  }

  // 2. Auto-commit if dirty
  if (isDirty()) {
    const msg = stageAndCommit();
    steps.push(`auto-committed: ${msg}`);
  }

  // 3. Pull --rebase
  const pull = gitSafe("pull --rebase --quiet");
  if (!pull.ok) {
    if (isRebasing() && hasConflicts()) {
      const files = git("diff --name-only --diff-filter=U").split("\n");
      return { steps, needsHelp: true, conflictFiles: files };
    }
    return { steps, error: `pull failed: ${pull.stderr}` };
  }

  if (pull.stdout && !pull.stdout.includes("Already up to date")) {
    steps.push("pulled remote changes");
  }

  // 4. Push
  const push = gitSafe("push --quiet");
  if (!push.ok) {
    return { steps, error: `push failed: ${push.stderr}` };
  }

  // 5. npm install (after pull, in case dependencies changed)
  const npm = npmInstall();
  if (npm.ok) {
    if (npm.output.length > 0) {
      steps.push("npm packages updated");
    } else {
      steps.push("npm packages up to date");
    }
  } else {
    steps.push(`npm install failed: ${npm.output}`);
  }

  if (steps.length === 0) {
    steps.push("already up to date");
  }

  return { steps };
}

// ── Extension ──────────────────────────────────────────────────

export default function piSync(pi: ExtensionAPI) {
  // ── Tool: pi_sync ────────────────────────────────────────

  pi.registerTool({
    name: "pi_sync",
    label: "Pi Sync",
    description:
      "Sync the pi-config repository (~/dev/pi-config) with GitHub: pulls remote changes, auto-commits local changes, pushes, and runs npm install. Call when the user asks to sync their pi config across machines.",
    parameters: Type.Object({}),
    async execute() {
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
          content: [{ type: "text", text: result.error }],
          details: {},
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: result.steps.join("; ") }],
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
        ctx.ui.notify(result.error, "error");
        return;
      }

      ctx.ui.notify(result.steps.join("; "), "success");
    },
  });
}
