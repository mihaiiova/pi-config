/**
 * pi-sync — sync ~/projects/pi-config with GitHub + reconcile npm packages
 *
 * Command: /pi-sync
 * Tool:    pi_sync (callable by LLM)
 *
 * Flow:
 *   1. Git: pull → auto-commit if dirty → push
 *   2. Packages: install missing (from pi-config list), ask to remove extras
 *   3. Run pi update --extensions
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
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

interface PkgEntry {
  source: string;
  type: "npm" | "git" | "local";
}

function getDesiredPackages(): PkgEntry[] {
  const pkgPath = join(REPO_PATH, "package.json");
  if (!existsSync(pkgPath)) return [];
  try {
    const raw = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const list: string[] = raw?.pi?.packages ?? [];
    return list.map((s) => ({ source: s, type: classifySource(s) }));
  } catch {
    return [];
  }
}

function getInstalledPackages(): PkgEntry[] {
  if (!existsSync(SETTINGS_PATH)) return [];
  try {
    const raw = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
    const list: (string | { source: string })[] = raw?.packages ?? [];
    const deduped = new Set<string>();
    const result: PkgEntry[] = [];
    for (const item of list) {
      const src = typeof item === "string" ? item : item.source;
      if (deduped.has(src)) continue;
      deduped.add(src);
      const type = classifySource(src);
      if (type !== "local") {
        result.push({ source: src, type });
      }
    }
    return result;
  } catch {
    return [];
  }
}

function classifySource(source: string): "npm" | "git" | "local" {
  if (source.startsWith("npm:")) return "npm";
  if (source.startsWith("git:") || source.match(/^(https?|ssh|git):\/\//)) return "git";
  return "local";
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

// ── TUI: extra packages selector ──────────────────────────────

class ExtraPackagesComponent {
  private cursorIdx = 0;
  private cachedLines: string[] | undefined;
  private cachedWidth: number | undefined;

  constructor(
    private extras: PkgEntry[],
    private keepSet: Set<number>, // indices to keep
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
      if (this.keepSet.has(idx)) {
        this.keepSet.delete(idx);
      } else {
        this.keepSet.add(idx);
      }
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
      ` ${t.fg("dim", "These are installed locally but not in pi-config. Space to deselect, Enter to confirm.")}`,
    );
    add("");

    for (let i = 0; i < this.extras.length; i++) {
      const pkg = this.extras[i];
      const keep = this.keepSet.has(i);
      const isCursor = i === this.cursorIdx;
      const check = keep ? t.fg("success", "✓") : t.fg("dim", "✗");
      const label = `${check} ${pkg.source}`;
      const cursorPrefix = isCursor ? t.fg("accent", ">") : " ";
      const styled = isCursor ? t.bg("selectedBg", label) : label;
      add(`${cursorPrefix} ${styled}`);
    }

    add("");
    add(
      ` ${t.fg("dim", `${this.keepSet.size} of ${this.extras.length} kept — unselected will be removed`)}`,
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

// ── Sync logic ────────────────────────────────────────────────

interface SyncResult {
  stage: string;
  steps: string[];
  error?: string;
  needsHelp?: boolean;
  conflictFiles?: string[];
  extrasPrompt?: PkgEntry[];
}

function gitSync(): SyncResult {
  const steps: string[] = [];

  const fetch = gitSafe("fetch --quiet");
  if (!fetch.ok) {
    return { stage: "git", steps, error: `fetch failed: ${fetch.stderr}` };
  }

  if (isDirty()) {
    const msg = stageAndCommit();
    steps.push(`auto-committed: ${msg}`);
  }

  const pull = gitSafe("pull --rebase --quiet");
  if (!pull.ok) {
    if (isRebasing() && hasConflicts()) {
      const files = git("diff --name-only --diff-filter=U").split("\n");
      return { stage: "git", steps, needsHelp: true, conflictFiles: files };
    }
    return { stage: "git", steps, error: `pull failed: ${pull.stderr}` };
  }

  if (pull.stdout && !pull.stdout.includes("Already up to date")) {
    steps.push("pulled remote changes");
  }

  const push = gitSafe("push --quiet");
  if (!push.ok) {
    return { stage: "git", steps, error: `push failed: ${push.stderr}` };
  }

  if (steps.length === 0) {
    steps.push("already up to date");
  }

  return { stage: "git", steps };
}

function computePackageDiff(): {
  missing: PkgEntry[];
  extras: PkgEntry[];
} {
  const desired = getDesiredPackages();
  const installed = getInstalledPackages();
  const installedSet = new Set(installed.map((p) => p.source));
  const desiredSet = new Set(desired.map((p) => p.source));

  const missing = desired.filter((p) => !installedSet.has(p.source));
  const extras = installed.filter((p) => !desiredSet.has(p.source));

  return { missing, extras };
}

// ── Extension ─────────────────────────────────────────────────

export default function piSync(pi: ExtensionAPI) {
  // ── Tool: pi_sync ────────────────────────────────────────

  pi.registerTool({
    name: "pi_sync",
    label: "Pi Sync",
    description:
      "Sync the pi-config repository (~/projects/pi-config) with GitHub and reconcile installed pi packages. Call when the user asks to sync their pi config across machines.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
      // Git stage
      const gs = gitSync();
      if (gs.error) {
        return {
          content: [{ type: "text", text: `Git sync error: ${gs.error}` }],
          details: {},
          isError: true,
        };
      }
      if (gs.needsHelp) {
        return {
          content: [
            {
              type: "text",
              text: `Merge conflict in pi-config! Conflicting files:\n${gs.conflictFiles!.map((f) => `  - ${f}`).join("\n")}\n\nAsk the user to resolve conflicts manually in ~/projects/pi-config, then run /pi-sync again.`,
            },
          ],
          details: {},
          isError: true,
        };
      }

      // Package stage
      const { missing, extras } = computePackageDiff();
      const pkgSteps: string[] = [];

      for (const p of missing) {
        const r = runPi(`install ${p.source} --approve`);
        if (r.ok) pkgSteps.push(`installed ${p.source}`);
        else pkgSteps.push(`failed to install ${p.source}: ${r.output}`);
      }

      if (extras.length > 0) {
        pkgSteps.push(
          `${extras.length} extra package(s) installed locally — run /pi-sync in TUI to review`,
        );
      }

      if (missing.length === 0 && extras.length === 0) {
        pkgSteps.push("packages up to date");
      } else {
        const u = runPi("update --extensions --approve");
        pkgSteps.push(
          u.ok ? "updated packages" : `update failed: ${u.output}`,
        );
      }

      return {
        content: [
          {
            type: "text",
            text: [
              `Git: ${gs.steps.join("; ")}`,
              `Packages: ${pkgSteps.join("; ")}`,
            ].join("\n"),
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
      // ── Git stage ──────────────────────────────────────

      ctx.ui.notify("Syncing pi-config git…", "info");
      const gs = gitSync();

      if (gs.needsHelp) {
        ctx.ui.notify(
          `Merge conflict! Files: ${gs.conflictFiles!.join(", ")}. Resolve in ~/projects/pi-config, then re-run /pi-sync.`,
          "error",
        );
        return;
      }

      if (gs.error) {
        ctx.ui.notify(`Git: ${gs.error}`, "error");
        return;
      }

      // ── Package diff ────────────────────────────────────

      const { missing, extras } = computePackageDiff();

      // ── Install missing ─────────────────────────────────

      for (const p of missing) {
        ctx.ui.notify(`Installing ${p.source}…`, "info");
        const r = runPi(`install ${p.source} --approve`);
        if (r.ok) {
          ctx.ui.notify(`Installed ${p.source}`, "success");
        } else {
          ctx.ui.notify(`Failed to install ${p.source}: ${r.output}`, "error");
        }
      }

      // ── Extra packages: ask user ────────────────────────

      if (extras.length > 0) {
        const keepSet = new Set<number>(extras.map((_, i) => i)); // all pre-selected

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
          // Remove unselected extras
          for (let i = 0; i < extras.length; i++) {
            if (!keepSet.has(i)) {
              ctx.ui.notify(`Removing ${extras[i].source}…`, "info");
              const r = runPi(`remove ${extras[i].source} --approve`);
              if (r.ok) {
                ctx.ui.notify(`Removed ${extras[i].source}`, "success");
              } else {
                ctx.ui.notify(
                  `Failed to remove ${extras[i].source}: ${r.output}`,
                  "error",
                );
              }
            }
          }
        }
      }

      // ── Update packages ─────────────────────────────────

      if (missing.length > 0 || (extras.length > 0)) {
        ctx.ui.notify("Updating packages…", "info");
        const u = runPi("update --extensions --approve");
        if (u.ok) {
          ctx.ui.notify("Packages updated", "success");
        } else {
          ctx.ui.notify(`Package update: ${u.output}`, "warning");
        }
      }

      ctx.ui.notify(`Git: ${gs.steps.join("; ")}`, "success");
    },
  });
}
