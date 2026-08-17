/**
 * pi-sync — sync ~/projects/pi-config with GitHub + reconcile packages
 *
 * Command: /pi-sync
 * Tool:    pi_sync (callable by LLM)
 *
 * Flow:
 *   1. Git: fetch → auto-commit if dirty → pull --rebase → push
 *   2. Packages: read pi.packages from package.json, compare with settings.json
 *      - Missing → pi install
 *      - Extras → ask user which to keep (all pre-selected, Space to deselect)
 *   3. pi update --extensions
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  Key,
  matchesKey,
  type Theme,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

// ── Config ────────────────────────────────────────────────────

const REPO_PATH = resolve(process.env.HOME!, "projects/pi-config");
const SETTINGS_PATH = resolve(process.env.HOME!, ".pi/agent/settings.json");

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

// ── Package helpers ───────────────────────────────────────────

function getDesiredPackages(): string[] {
  const pkgPath = join(REPO_PATH, "package.json");
  if (!existsSync(pkgPath)) return [];
  try {
    const raw = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return (raw?.pi?.packages ?? []) as string[];
  } catch {
    return [];
  }
}

function getInstalledPackages(): string[] {
  if (!existsSync(SETTINGS_PATH)) return [];
  try {
    const raw = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
    const list: (string | { source: string })[] = raw?.packages ?? [];
    return list
      .map((item) => (typeof item === "string" ? item : item.source))
      .filter((src) => src.startsWith("npm:") || src.startsWith("git:"));
  } catch {
    return [];
  }
}

function runPi(args: string): { ok: boolean; output: string } {
  try {
    const out = execSync(`pi ${args}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PI_NO_COLOR: "1" },
    });
    return { ok: true, output: out.trim() };
  } catch (err: any) {
    const msg = err.stderr?.trim() || err.stdout?.trim() || err.message;
    return { ok: false, output: msg };
  }
}

function computeDiff(): { missing: string[]; extras: string[] } {
  const desired = new Set(getDesiredPackages());
  const installed = new Set(getInstalledPackages());

  const missing = [...desired].filter((p) => !installed.has(p));
  const extras = [...installed].filter((p) => !desired.has(p));

  return { missing, extras };
}

// ── TUI: extra packages selector ──────────────────────────────

class ExtraPackagesComponent {
  private cursorIdx = 0;
  private cachedLines: string[] | undefined;
  private cachedWidth: number | undefined;

  constructor(
    private extras: string[],
    private keepSet: Set<number>,
    private theme: Theme,
    private onUpdate: () => void,
    private onConfirm: (keepIndices: Set<number>) => void,
    private onCancel: () => void,
  ) {}

  handleInput(data: string): void {
    if (this.extras.length === 0) return;

    if (matchesKey(data, Key.up)) {
      this.cursorIdx = Math.max(0, this.cursorIdx - 1);
      this.cachedLines = undefined;
      this.onUpdate();
      return;
    }
    if (matchesKey(data, Key.down)) {
      this.cursorIdx = Math.min(this.extras.length - 1, this.cursorIdx + 1);
      this.cachedLines = undefined;
      this.onUpdate();
      return;
    }
    if (matchesKey(data, Key.space)) {
      const idx = this.cursorIdx;
      if (this.keepSet.has(idx)) this.keepSet.delete(idx);
      else this.keepSet.add(idx);
      this.cachedLines = undefined;
      this.onUpdate();
      return;
    }
    if (matchesKey(data, Key.enter)) {
      this.onConfirm(this.keepSet);
      return;
    }
    if (matchesKey(data, Key.escape)) {
      this.onCancel();
      return;
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const t = this.theme;
    const lines: string[] = [];
    const rw = Math.max(1, width);

    function add(str: string): void {
      lines.push(...wrapTextWithAnsi(str, rw));
    }

    lines.push(t.fg("accent", "─".repeat(rw)));
    add(` ${t.fg("warning", t.bold("Extra packages detected"))}`);
    add(
      ` ${t.fg("dim", "Packages installed locally but not in pi-config. Unselected ones will be removed.")}`,
    );
    add("");

    for (let i = 0; i < this.extras.length; i++) {
      const pkg = this.extras[i];
      const keep = this.keepSet.has(i);
      const isCursor = i === this.cursorIdx;
      const check = keep ? t.fg("success", "✓") : t.fg("dim", "✗");
      const label = `${check} ${pkg}`;
      const cursorPrefix = isCursor ? t.fg("accent", ">") : " ";
      const styled = isCursor ? t.bg("selectedBg", label) : label;
      add(`${cursorPrefix} ${styled}`);
    }

    add("");
    add(
      ` ${t.fg("dim", `${this.keepSet.size} of ${this.extras.length} kept`)}`,
    );
    add("");
    add(
      ` ${t.fg("dim", "↑↓ navigate  ·  Space toggle  ·  Enter confirm  ·  Esc cancel")}`,
    );
    lines.push(t.fg("accent", "─".repeat(rw)));

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}

// ── Sync ──────────────────────────────────────────────────────

interface SyncResult {
  steps: string[];
  error?: string;
  needsHelp?: boolean;
  conflictFiles?: string[];
}

function gitSync(): SyncResult {
  const steps: string[] = [];

  const fetch = gitSafe("fetch --quiet");
  if (!fetch.ok) {
    return { steps, error: `fetch failed: ${fetch.stderr}` };
  }

  if (isDirty()) {
    const msg = stageAndCommit();
    steps.push(`auto-committed: ${msg}`);
  }

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

  const push = gitSafe("push --quiet");
  if (!push.ok) {
    return { steps, error: `push failed: ${push.stderr}` };
  }

  if (steps.length === 0) {
    steps.push("already up to date");
  }

  return { steps };
}

// ── Extension ─────────────────────────────────────────────────

export default function piSync(pi: ExtensionAPI) {
  // ── Tool: pi_sync ────────────────────────────────────────

  pi.registerTool({
    name: "pi_sync",
    label: "Pi Sync",
    description:
      "Sync pi-config (~/projects/pi-config) with GitHub and reconcile installed pi packages. Call when the user asks to sync their pi config across machines.",
    parameters: Type.Object({}),
    async execute() {
      const gs = gitSync();
      if (gs.error) {
        return {
          content: [{ type: "text", text: `Git: ${gs.error}` }],
          details: {},
          isError: true,
        };
      }
      if (gs.needsHelp) {
        return {
          content: [
            {
              type: "text",
              text: `Merge conflict! Files:\n${gs.conflictFiles!.map((f) => `  - ${f}`).join("\n")}\n\nAsk the user to resolve in ~/projects/pi-config, then re-run /pi-sync`,
            },
          ],
          details: {},
          isError: true,
        };
      }

      const { missing, extras } = computeDiff();
      const pkgSteps: string[] = [];

      for (const p of missing) {
        const r = runPi(`install ${p} --approve`);
        pkgSteps.push(r.ok ? `installed ${p}` : `failed: ${p} — ${r.output}`);
      }

      if (extras.length > 0) {
        pkgSteps.push(
          `${extras.length} extra(s) — run /pi-sync in TUI to review`,
        );
      }

      if (missing.length === 0 && extras.length === 0) {
        pkgSteps.push("packages up to date");
      }

      if (missing.length > 0 || extras.length > 0) {
        const u = runPi("update --extensions --approve");
        pkgSteps.push(
          u.ok ? "updated packages" : `update failed: ${u.output}`,
        );
      }

      return {
        content: [
          {
            type: "text",
            text: [`Git: ${gs.steps.join("; ")}`, `Packages: ${pkgSteps.join("; ")}`].join("\n"),
          },
        ],
        details: {},
      };
    },
  });

  // ── Command: /pi-sync ────────────────────────────────────

  pi.registerCommand("pi-sync", {
    description: "Sync pi-config (~/projects/pi-config) with GitHub + reconcile packages",
    handler: async (_args, ctx) => {
      // ── Git ────────────────────────────────────────────

      ctx.ui.notify("Syncing pi-config…", "info");
      const gs = gitSync();

      if (gs.needsHelp) {
        ctx.ui.notify(
          `Merge conflict! Files: ${gs.conflictFiles!.join(", ")}. Resolve in ~/projects/pi-config, then re-run /pi-sync`,
          "error",
        );
        return;
      }
      if (gs.error) {
        ctx.ui.notify(gs.error, "error");
        return;
      }

      // ── Packages ────────────────────────────────────────

      const { missing, extras } = computeDiff();

      for (const p of missing) {
        ctx.ui.notify(`Installing ${p}…`, "info");
        const r = runPi(`install ${p} --approve`);
        if (r.ok) ctx.ui.notify(`Installed ${p}`, "success");
        else ctx.ui.notify(`Failed: ${p} — ${r.output}`, "error");
      }

      if (extras.length > 0) {
        const keepSet = new Set<number>(extras.map((_, i) => i));

        const result = await ctx.ui.custom<{ cancelled: boolean } | null>(
          (tui, theme, _kb, done) => {
            const comp = new ExtraPackagesComponent(
              extras,
              keepSet,
              theme,
              () => tui.requestRender(),
              () => done({ cancelled: false }),
              () => done({ cancelled: true }),
            );
            return {
              render: (w: number) => comp.render(w),
              invalidate: () => comp.invalidate(),
              handleInput: (data: string) => comp.handleInput(data),
            };
          },
        );

        if (result && !result.cancelled) {
          for (let i = 0; i < extras.length; i++) {
            if (!keepSet.has(i)) {
              ctx.ui.notify(`Removing ${extras[i]}…`, "info");
              const r = runPi(`remove ${extras[i]}`);
              if (r.ok) ctx.ui.notify(`Removed ${extras[i]}`, "success");
              else ctx.ui.notify(`Failed: ${extras[i]} — ${r.output}`, "error");
            }
          }
        }
      }

      if (missing.length > 0 || extras.length > 0) {
        ctx.ui.notify("Updating packages…", "info");
        const u = runPi("update --extensions --approve");
        if (u.ok) ctx.ui.notify("Packages updated", "success");
        else ctx.ui.notify(`Update: ${u.output}`, "warning");
      }

      ctx.ui.notify(`Git: ${gs.steps.join("; ")}`, "success");
    },
  });
}
