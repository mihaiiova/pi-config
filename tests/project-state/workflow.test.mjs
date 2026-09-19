import assert from "node:assert/strict";
import { detectWorkflow } from "../../extensions/project-state/workflow.mjs";

const user = (text) => ({ type: "message", message: { role: "user", content: text } });
const userBlocks = (text) => ({
  type: "message",
  message: { role: "user", content: [{ type: "text", text }] },
});
const assistant = () => ({ type: "message", message: { role: "assistant" } });

// ── 1. First /spec-* command wins ──
const firstWins = detectWorkflow([
  user("/spec-new #10"),
  user("/spec-start #10"),
]);
assert.equal(firstWins, "spec-new");
console.log("ok - detectWorkflow returns the first /spec-* command");

// ── 2. The /skill:spec-start form resolves to the bare skill name ──
assert.equal(detectWorkflow([user("/skill:spec-start #10")]), "spec-start");
console.log("ok - detectWorkflow handles the /skill: prefix");

// ── 3. Array content (text blocks) are scanned ──
assert.equal(detectWorkflow([userBlocks("/spec-review #10")]), "spec-review");
console.log("ok - detectWorkflow scans array-form user content");

// ── 4. No /spec-* command → null ──
assert.equal(detectWorkflow([user("please review my code")]), null);
assert.equal(detectWorkflow([]), null);
assert.equal(detectWorkflow(null), null);
console.log("ok - detectWorkflow returns null when no /spec-* command is present");

// ── 5. Non-spec commands → null ──
assert.equal(detectWorkflow([user("/session-history"), user("/session-cost")]), null);
console.log("ok - detectWorkflow ignores non-spec commands");

// ── 6. Assistant messages are ignored ──
assert.equal(detectWorkflow([assistant(), user("/spec-audit")]), "spec-audit");
assert.equal(detectWorkflow([assistant()]), null);
console.log("ok - detectWorkflow only reads user messages");
