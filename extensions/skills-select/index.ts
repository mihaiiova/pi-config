/**
 * Skills Select — per-project skill allowlist extension
 *
 * Lets you choose which skills are active for the current project.
 * Disabled skills are stripped from the system prompt before every agent run.
 *
 * Command: /skills-select
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import {
  Key,
  matchesKey,
  type Theme,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Types ─────────────────────────────────────────────────────

interface SkillsConfig {
  skills: string[];
  configured: boolean;
}

interface SkillInfo {
  name: string;
  group: string | null;
}

interface SkillGroup {
  name: string;
  skills: string[];
}

type Row =
  | { type: "group"; groupName: string; selectedCount: number; totalCount: number }
  | { type: "skill"; skillName: string; groupName: string | null };

// ── Helpers ───────────────────────────────────────────────────

function deriveGroup(name: string): string | null {
  const idx = name.indexOf("-");
  return idx === -1 ? null : name.slice(0, idx);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Config I/O ────────────────────────────────────────────────

function getConfigPath(cwd: string): string {
  return join(cwd, CONFIG_DIR_NAME, "extensions", "skills-select", "skills-config.json");
}

function loadConfig(configPath: string): SkillsConfig {
  try {
    if (existsSync(configPath)) {
      const raw = readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.skills)) {
        return { skills: parsed.skills, configured: true };
      }
    }
  } catch {
    // Malformed or missing
  }
  return { skills: [], configured: false };
}

function saveConfig(configPath: string, config: SkillsConfig): void {
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

function buildGroups(skills: SkillInfo[]): { groups: SkillGroup[]; standalone: string[] } {
  const groupMap = new Map<string, string[]>();
  const standalone: string[] = [];

  for (const s of skills) {
    if (s.group) {
      const list = groupMap.get(s.group);
      if (list) list.push(s.name);
      else groupMap.set(s.group, [s.name]);
    } else {
      standalone.push(s.name);
    }
  }

  const groups: SkillGroup[] = [];
  for (const [name, skillList] of [...groupMap.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (skillList.length > 1) {
      groups.push({ name, skills: skillList.sort() });
    } else {
      standalone.push(skillList[0]);
    }
  }

  return { groups, standalone: standalone.sort() };
}

// ── TUI Component ─────────────────────────────────────────────

class SkillsSelectComponent {
  private cursorIdx = 0;
  private rows: Row[] = [];
  private cachedLines: string[] | undefined;
  private cachedWidth: number | undefined;

  constructor(
    private groups: SkillGroup[],
    private standalone: string[],
    private selected: Set<string>,
    private expanded: Set<string>,
    private theme: Theme,
    private onUpdate: () => void,
    private onSave: () => void,
    private onCancel: () => void,
  ) {
    this.rebuildRows();
  }

  private rebuildRows(): void {
    this.rows = [];

    for (const group of this.groups) {
      const selectedCount = group.skills.filter((s) => this.selected.has(s)).length;
      this.rows.push({
        type: "group",
        groupName: group.name,
        selectedCount,
        totalCount: group.skills.length,
      });
      if (this.expanded.has(group.name)) {
        for (const skill of group.skills) {
          this.rows.push({ type: "skill", skillName: skill, groupName: group.name });
        }
      }
    }

    // Standalone section
    if (this.standalone.length > 0) {
      for (const skill of this.standalone) {
        this.rows.push({ type: "skill", skillName: skill, groupName: null });
      }
    }

    if (this.cursorIdx >= this.rows.length) {
      this.cursorIdx = Math.max(0, this.rows.length - 1);
    }
    // If empty, set to 0 (valid even if no rows)
    if (this.rows.length === 0) {
      this.cursorIdx = 0;
    }
  }

  private getCurrentRow(): Row | undefined {
    return this.rows[this.cursorIdx];
  }

  private toggleSkill(name: string): void {
    if (this.selected.has(name)) {
      this.selected.delete(name);
    } else {
      this.selected.add(name);
    }
  }

  // ── Component interface ─────────────────────────────────

  handleInput(data: string): void {
    if (this.rows.length === 0) {
      if (matchesKey(data, Key.escape)) this.onCancel();
      return;
    }

    const row = this.getCurrentRow();

    if (matchesKey(data, Key.up)) {
      this.cursorIdx = Math.max(0, this.cursorIdx - 1);
      this.cachedLines = undefined;
      this.onUpdate();
      return;
    }
    if (matchesKey(data, Key.down)) {
      this.cursorIdx = Math.min(this.rows.length - 1, this.cursorIdx + 1);
      this.cachedLines = undefined;
      this.onUpdate();
      return;
    }
    if (matchesKey(data, Key.space)) {
      if (!row) return;
      if (row.type === "group") {
        // Smart toggle: if any unselected → select all, if all selected → deselect all
        const group = this.groups.find((g) => g.name === row.groupName);
        if (group) {
          const allSelected = group.skills.every((s) => this.selected.has(s));
          if (allSelected) {
            for (const s of group.skills) this.selected.delete(s);
          } else {
            for (const s of group.skills) this.selected.add(s);
          }
        }
      } else if (row.type === "skill") {
        this.toggleSkill(row.skillName);
      }
      this.rebuildRows();
      this.cachedLines = undefined;
      this.onUpdate();
      return;
    }
    if (matchesKey(data, Key.right)) {
      if (row?.type === "group") {
        this.expanded.add(row.groupName);
        this.rebuildRows();
        this.cachedLines = undefined;
        this.onUpdate();
      }
      return;
    }
    if (matchesKey(data, Key.left)) {
      if (row?.type === "group") {
        this.expanded.delete(row.groupName);
        this.rebuildRows();
        this.cachedLines = undefined;
        this.onUpdate();
      }
      return;
    }
    if (matchesKey(data, Key.enter)) {
      this.onSave();
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

    // Header
    lines.push(t.fg("accent", "─".repeat(rw)));
    add(` ${t.fg("accent", t.bold("Skills Selection"))}`);
    add(` ${t.fg("dim", `${this.selected.size} skill(s) active`)}`);
    add("");

    if (this.rows.length === 0) {
      add(` ${t.fg("warning", "No skills discovered yet.")}`);
      add(` ${t.fg("dim", "Start a conversation to load skills, then run /skills-select again.")}`);
    } else {
      for (let i = 0; i < this.rows.length; i++) {
        const row = this.rows[i];
        const isCursor = i === this.cursorIdx;

        if (row.type === "group") {
          const expanded = this.expanded.has(row.groupName);
          const arrow = expanded ? "▼" : "▶";
          const allSelected = row.selectedCount === row.totalCount;
          const someSelected = row.selectedCount > 0 && row.selectedCount < row.totalCount;
          const check = allSelected ? t.fg("success", "✓") : someSelected ? t.fg("warning", "◐") : " ";
          const count = t.fg("dim", `(${row.selectedCount}/${row.totalCount})`);
          const label = `${check} ${arrow} ${t.bold(row.groupName)} ${count}`;
          const cursorPrefix = isCursor ? t.fg("accent", ">") : " ";
          const styled = isCursor ? t.bg("selectedBg", label) : label;
          add(`${cursorPrefix} ${styled}`);
        } else if (row.type === "skill") {
          const checked = this.selected.has(row.skillName);
          const check = checked ? t.fg("success", "✓") : " ";
          const indent = "   "; // indented under group
          const label = `${check} ${row.skillName}`;
          const cursorPrefix = isCursor ? t.fg("accent", ">") : " ";
          const styled = isCursor ? t.bg("selectedBg", label) : label;
          add(`${cursorPrefix} ${indent}${styled}`);
        }
      }
    }

    // Footer help
    add("");
    add(` ${t.fg("dim", "↑↓ navigate  ·  Space toggle  ·  ←→ expand/collapse  ·  Enter save  ·  Esc cancel")}`);

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

// ── Extension ──────────────────────────────────────────────────

export default function skillsSelect(pi: ExtensionAPI) {
  let config: SkillsConfig = { skills: [], configured: false };
  let configPath: string | null = null;
  const discoveredSkills: SkillInfo[] = [];
  let skillsDiscovered = false;

  // ── Footer status ──────────────────────────────────────────

  function updateFooter(ctx: { ui: { theme: { fg: (c: string, s: string) => string }; setStatus: (k: string, v: string | undefined) => void } }): void {
    const dim = (s: string) => ctx.ui.theme.fg("dim", s);
    if (config.configured) {
      ctx.ui.setStatus("skills-select", dim(`Skills: ${config.skills.length} active — /skills-select`));
    } else {
      ctx.ui.setStatus("skills-select", dim("Skills: all active — /skills-select to configure"));
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────

  pi.on("session_start", (event, ctx) => {
    configPath = getConfigPath(ctx.cwd);
    config = loadConfig(configPath);

    // Re-discover skills after /reload (new skills may have been installed)
    if (event.reason === "reload") {
      discoveredSkills.length = 0;
      skillsDiscovered = false;
    }

    updateFooter(ctx);
  });

  pi.on("session_shutdown", (_event, ctx) => {
    ctx.ui.setStatus("skills-select", undefined);
  });

  // ── Skill discovery + system prompt filtering ──────────────

  pi.on("before_agent_start", (event, ctx) => {
    if (!configPath) configPath = getConfigPath(ctx.cwd);
    if (!config.configured && !skillsDiscovered) {
      // Reload config in case it was saved by another session
      config = loadConfig(configPath!);
    }

    // Discover available skills from the system prompt options
    const options = event.systemPromptOptions as { skills?: Array<{ name: string }> };
    const loadedSkills: Array<{ name: string }> = options.skills ?? [];
    if (!skillsDiscovered && loadedSkills.length > 0) {
      for (const s of loadedSkills) {
        discoveredSkills.push({ name: s.name, group: deriveGroup(s.name) });
      }
      skillsDiscovered = true;
    }

    updateFooter(ctx);

    // If not configured, all skills are active — no filtering needed
    if (!config.configured) return;

    // Filter system prompt: remove <skill> blocks for disabled skills
    const disabled = discoveredSkills
      .filter((s) => !config.skills.includes(s.name))
      .map((s) => s.name);

    if (disabled.length === 0) return;

    let prompt = event.systemPrompt;
    for (const name of disabled) {
      const regex = new RegExp(
        `<skill>\\s*<name>${escapeRegex(name)}<\\/name>.*?<\\/skill>`,
        "s",
      );
      prompt = prompt.replace(regex, "");
    }

    return { systemPrompt: prompt };
  });

  // ── Command: /skills-select ────────────────────────────────

  pi.registerCommand("skills-select", {
    description: "Choose which skills are active for this project",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("Skills selection requires TUI mode", "warning");
        return;
      }

      if (!configPath) configPath = getConfigPath(ctx.cwd);
      config = loadConfig(configPath);

      // Try to discover skills if not yet done
      if (!skillsDiscovered) {
        try {
          const options = (ctx as any).getSystemPromptOptions?.();
          const loadedSkills: Array<{ name: string }> = options?.skills ?? [];
          if (loadedSkills.length > 0) {
            for (const s of loadedSkills) {
              discoveredSkills.push({ name: s.name, group: deriveGroup(s.name) });
            }
            skillsDiscovered = true;
          }
        } catch {
          // getSystemPromptOptions not available — skills not yet loaded
        }
      }

      if (discoveredSkills.length === 0) {
        ctx.ui.notify(
          "No skills discovered yet. Start a conversation first, then run /skills-select.",
          "warning",
        );
        return;
      }

      const { groups, standalone } = buildGroups(discoveredSkills);

      // Build initial selected set
      const selected = new Set<string>(
        config.configured ? config.skills : discoveredSkills.map((s) => s.name),
      );

      // Track expanded groups (all collapsed by default)
      const expanded = new Set<string>();

      const result = await ctx.ui.custom<{ cancelled: boolean } | null>(
        (tui, theme, _keybindings, done) => {
          const comp = new SkillsSelectComponent(
            groups,
            standalone,
            selected,
            expanded,
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
        config = {
          skills: [...selected].sort(),
          configured: true,
        };
        try {
          saveConfig(configPath!, config);
        } catch (err: any) {
          ctx.ui.notify(`Failed to save config: ${err.message}`, "error");
          return;
        }
        updateFooter(ctx);
        const msg =
          config.skills.length === discoveredSkills.length
            ? `All ${config.skills.length} skills active`
            : `${config.skills.length} of ${discoveredSkills.length} skills active`;
        ctx.ui.notify(`Saved: ${msg}`, "success");
      }
    },
  });
}
