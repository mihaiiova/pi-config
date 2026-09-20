import assert from "node:assert/strict";
import {
  formatStatus,
  formatHistory,
  formatCost,
} from "../../extensions/project-state/presentation.mjs";

// ── 1. Status projection: known and empty cases ──
const status = formatStatus(
  {
    branch: "spec/10-x",
    activeSpec: { number: 10, title: "Add project state" },
    phase: "in-progress",
    lastSessionId: "sess-1",
    pendingWork: null,
  },
  { totalTokens: 1234, cost: { total: 0.125 } },
);
assert.ok(status.includes("branch: spec/10-x"));
assert.ok(status.includes("spec: #10 (in-progress)"));
assert.ok(status.includes("phase: in-progress"));
assert.ok(status.includes("pending: (none)"));
assert.ok(status.includes("last session: sess-1"));
assert.ok(status.includes("current session cost: $0.1250 (1234 tokens)"));

const emptyStatus = formatStatus(null, null);
assert.ok(emptyStatus.includes("branch: (none)"));
assert.ok(emptyStatus.includes("spec: (none)"));
assert.ok(emptyStatus.includes("current session cost: unknown"));
console.log("ok - formatStatus renders the projection and tolerates missing data");

// ── 2. History: rows with date/spec/outcome/cost and empty case ──
const records = [
  {
    finalizedAt: "2026-09-17T14:00:00.000Z",
    activeSpec: { number: 10 },
    outcome: "completed",
    usage: { cost: { total: 0.5 } },
    summary: "did the thing",
  },
  {
    startedAt: "2026-09-16T10:00:00.000Z",
    activeSpec: null,
    outcome: null,
    usage: null,
    summary: null,
  },
];
const history = formatHistory(records);
assert.ok(history.includes("2026-09-17"));
assert.ok(history.includes("spec=#10"));
assert.ok(history.includes("outcome=completed"));
assert.ok(history.includes("cost=$0.5000"));
assert.ok(history.includes("did the thing"));
assert.ok(history.includes("2026-09-16"));
assert.ok(history.includes("outcome=-"));
assert.ok(history.includes("cost=-"));
assert.equal(formatHistory([]), "No recorded sessions yet.");
console.log("ok - formatHistory renders date/spec/outcome/cost/summary and empty state");

// ── 2b. History renders workflow and delegation roles, tolerating null ──
const identityRecords = [
  {
    finalizedAt: "2026-09-18T14:00:00.000Z",
    activeSpec: { number: 167 },
    workflow: "spec-start",
    usage: { cost: { total: 0.25 } },
    subagentUsage: {
      agents: [
        { agent: "worker", status: "completed", model: "gpt-5", runs: 1, cost: 0.1 },
        { agent: "reviewer", status: "failed", model: null, runs: 2, cost: 0.15 },
      ],
      totalCost: 0.25,
    },
  },
  {
    finalizedAt: "2026-09-17T10:00:00.000Z",
    activeSpec: null,
    workflow: null,
    usage: null,
    subagentUsage: null,
  },
];
const identityHistory = formatHistory(identityRecords);
assert.ok(identityHistory.includes("workflow=spec-start"));
assert.ok(identityHistory.includes("worker(completed)"));
assert.ok(identityHistory.includes("reviewer(failed)"));
assert.ok(identityHistory.includes("workflow=general"));
assert.ok(identityHistory.includes("subagents=-"));
console.log("ok - formatHistory renders workflow and delegation roles and tolerates null");

// ── 3. Cost: current, recent, and aggregate with unknown gaps ──
const costRecords = [
  { usage: { cost: { total: 1.0 } } },
  { usage: { cost: { total: 2.0 } } },
  { usage: null },
];
const cost = formatCost({ cost: { total: 0.25 } }, costRecords, { limit: 2 });
assert.ok(cost.includes("current session: $0.2500"));
assert.ok(cost.includes("recent (2 of 2): $3.0000"));
assert.ok(cost.includes("project aggregate (2 sessions): $3.0000"));

const unknownCost = formatCost(null, []);
assert.ok(unknownCost.includes("current session: unknown"));
assert.ok(unknownCost.includes("recent (0 of 0): unknown"));
assert.ok(unknownCost.includes("project aggregate (0 sessions): unknown"));
console.log("ok - formatCost renders current/recent/aggregate and unknown gaps");
