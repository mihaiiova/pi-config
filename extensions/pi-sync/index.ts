/**
 * pi-sync — sync the pi-config repo with GitHub + reconcile packages
 *
 * Command: /pi-sync
 * Tool:    pi_sync (callable by LLM)
 *
 * Flow:
 *   1. Git: refuse dirty tool calls, or ask before committing in TUI; then sync
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
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGitClient } from "./git-sync.mjs";

// ── Config ────────────────────────────────────────────────────

// Derive the repo root from this extension's own location instead of a
// hardcoded path — pi-config is cloned to different locations per machine.
const REPO_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SETTINGS_PATH = resolve(process.env.HOME!, ".pi/agent/settings.json");
const gitClient = createGitClient(REPO_PATH);

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

// ── Extension ─────────────────────────────────────────────────

export default function piSync(pi: ExtensionAPI) {
  // ── Tool: pi_sync ────────────────────────────────────────

  pi.registerTool({
    name: "pi_sync",
    label: "Pi Sync",
    description:
      "Sync the pi-config repo with GitHub and reconcile installed pi packages. Call when the user asks to sync their pi config across machines.",
    parameters: Type.Object({}),
    async execute() {
      const gs = gitClient.syncClean();
      if (gs.dirtyFiles) {
        return {
          content: [
            {
              type: "text",
              text: `Git: sync refused because pi-config has local changes:\n${gs.dirtyFiles.map((f) => `  - ${f}`).join("\n")}\n\nReview and commit them explicitly, or run /pi-sync in TUI to choose whether to commit and sync.`,
            },
          ],
          details: {},
          isError: true,
        };
      }
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
              text: `Merge conflict! Files:\n${gs.conflictFiles!.map((f) => `  - ${f}`).join("\n")}\n\nAsk the user to resolve in ${REPO_PATH}, then re-run /pi-sync`,
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
    description: "Sync the pi-config repo with GitHub + reconcile packages",
    handler: async (_args, ctx) => {
      // ── Git ────────────────────────────────────────────

      const dirtyFiles = gitClient.getDirtyFiles();
      if (dirtyFiles.length > 0) {
        const confirmed = await ctx.ui.confirm(
          "Local changes detected",
          `${dirtyFiles.map((f) => `  ${f}`).join("\n")}\n\nCommit all listed changes and sync?`,
        );
        if (!confirmed) {
          ctx.ui.notify(
            "Sync cancelled; local changes were not committed",
            "warning",
          );
          return;
        }

        try {
          const message = gitClient.commitAllChanges();
          ctx.ui.notify(`Committed: ${message}`, "success");
        } catch (err: any) {
          ctx.ui.notify(
            `Commit failed: ${err.stderr?.trim() ?? err.message}`,
            "error",
          );
          return;
        }
      }

      ctx.ui.notify("Syncing pi-config…", "info");
      const gs = gitClient.syncClean();

      if (gs.dirtyFiles) {
        ctx.ui.notify(
          `Sync refused because new local changes appeared: ${gs.dirtyFiles.join(", ")}`,
          "error",
        );
        return;
      }

      if (gs.needsHelp) {
        ctx.ui.notify(
          `Merge conflict! Files: ${gs.conflictFiles!.join(", ")}. Resolve in ${REPO_PATH}, then re-run /pi-sync`,
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
