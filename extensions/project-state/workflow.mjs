/**
 * project-state workflow — deterministic detection of the lifecycle skill that
 * drove a session.
 *
 * Workflow identity comes only from the session's own user messages — never
 * from branch names, GitHub labels, or any other inference. A session with no
 * `/spec-*` command in its user messages has no workflow.
 */

/**
 * Detect the lifecycle skill (`spec-new`, `spec-start`, `spec-review`, …) that
 * drove the session, from the first user message containing a `/spec-*`
 * command. Returns the bare skill name (the `skill:` prefix, when present, is
 * stripped) or `null` when no such command appears.
 *
 * The command vocabulary is shared with `/spec-cost`'s skill detection and
 * matches the `/spec-*` skill names plus the `/skill:spec-*` invocation form.
 */
export function detectWorkflow(entries) {
  for (const entry of entries ?? []) {
    if (entry?.type !== "message") continue;
    if (entry.message?.role !== "user") continue;
    const match = userText(entry.message).match(/(?:skill:)?spec-[a-z-]+/);
    if (match) return match[0].replace(/^skill:/, "");
  }
  return null;
}

/** Extract the searchable text of a user message (string or content blocks). */
function userText(message) {
  const content = message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((block) => block?.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("\n");
  }
  return "";
}
