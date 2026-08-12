/**
 * Save MD — save the last agent response as a markdown file
 *
 * Usage:
 *   /save-md              → docs/agent-responses/YYYY-MM-DD-HHmmss.md
 *   /save-md my-notes     → docs/agent-responses/my-notes.md
 *   /save-md sub/notes    → docs/agent-responses/sub/notes.md
 *
 * Each file includes YAML frontmatter with date, model, and session info.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function timestampFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

function buildFrontmatter(meta: Record<string, string>): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(meta)) {
    lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
  }
  lines.push("---", "", "");
  return lines.join("\n");
}

export default function saveMd(pi: ExtensionAPI) {
  pi.registerCommand("save-md", {
    description: "Save the last agent response as a markdown file in docs/agent-responses/",
    handler: async (args, ctx) => {
      // Find the last assistant message
      const entries = ctx.sessionManager.getEntries();
      let lastAssistant: any = null;
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (entry.type === "message" && entry.message?.role === "assistant") {
          lastAssistant = entry.message;
          break;
        }
      }

      if (!lastAssistant) {
        ctx.ui.notify("No assistant response found in this session", "warning");
        return;
      }

      // Extract text content
      const textParts: string[] = [];
      for (const block of lastAssistant.content ?? []) {
        if (block.type === "text" && block.text) {
          textParts.push(block.text);
        }
      }
      const body = textParts.join("\n\n");
      if (!body.trim()) {
        ctx.ui.notify("The last response has no text content", "warning");
        return;
      }

      // Determine filename
      let relPath: string;
      if (args?.trim()) {
        const cleaned = sanitizeFilename(args.trim());
        relPath = cleaned.endsWith(".md") ? cleaned : `${cleaned}.md`;
      } else {
        relPath = `${timestampFilename()}.md`;
      }

      // Save to docs/agent-responses/
      const dir = join(ctx.cwd, "docs", "agent-responses");
      mkdirSync(dir, { recursive: true });

      const filePath = join(dir, relPath);
      const subDir = dirname(filePath);
      if (!existsSync(subDir)) {
        mkdirSync(subDir, { recursive: true });
      }

      const sessionFile = ctx.sessionManager.getSessionFile() ?? "ephemeral";
      const modelId = (ctx as any).model
        ? `${(ctx as any).model.provider}/${(ctx as any).model.id}`
        : "unknown";

      const frontmatter = buildFrontmatter({
        date: new Date().toISOString(),
        model: modelId,
        session: sessionFile,
      });

      try {
        writeFileSync(filePath, frontmatter + body + "\n", "utf-8");
        ctx.ui.notify(`Saved: ${relPath}`, "success");
      } catch (err: any) {
        ctx.ui.notify(`Failed to save: ${err.message}`, "error");
      }
    },
  });
}
