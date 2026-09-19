import assert from "node:assert/strict";
import {
  SCHEMA_VERSION,
  SchemaError,
  MIGRATIONS,
  migrateDocument,
  createStateDocument,
  createSessionDocument,
} from "../../extensions/project-state/schema.mjs";

// ── 1. Version constant and empty (v1-current) migration registry ──
assert.equal(SCHEMA_VERSION, 1);
assert.deepEqual(MIGRATIONS, {});
console.log("ok - schema v1 is current with no historical migrations registered");

// ── 2. Valid current-version documents pass through unchanged ──
const doc = { schemaVersion: 1, branch: "development", activeSpec: null };
assert.deepEqual(migrateDocument(doc), doc);
console.log("ok - migrateDocument passes a current-version document through unchanged");

// ── 3. Malformed documents are rejected safely ──
for (const bad of [null, "x", 42, [], true]) {
  assert.throws(() => migrateDocument(bad), SchemaError);
}
assert.throws(() => migrateDocument({}), SchemaError); // missing schemaVersion
assert.throws(() => migrateDocument({ schemaVersion: "1" }), SchemaError); // non-integer
assert.throws(() => migrateDocument({ schemaVersion: 1.5 }), SchemaError);
assert.throws(() => migrateDocument({ schemaVersion: 0 }), SchemaError);
assert.throws(() => migrateDocument({ schemaVersion: -1 }), SchemaError);
console.log("ok - migrateDocument rejects non-objects, missing, and non-positive schemaVersion");

// ── 4. Unsupported (future) versions are rejected ──
assert.throws(() => migrateDocument({ schemaVersion: 2 }), SchemaError);
assert.throws(() => migrateDocument({ schemaVersion: 99 }), SchemaError);
console.log("ok - migrateDocument rejects documents newer than the current schema");

// ── 5. Future migration dispatch (injectable registry) ──
const injected = {
  1: (d) => ({ ...d, schemaVersion: 2, added: "migrated" }),
  2: (d) => ({ ...d, schemaVersion: 3 }),
};
const migrated = migrateDocument({ schemaVersion: 1, branch: "spec/1-x" }, {
  targetVersion: 3,
  migrations: injected,
});
assert.equal(migrated.schemaVersion, 3);
assert.equal(migrated.added, "migrated");
assert.equal(migrated.branch, "spec/1-x");
console.log("ok - migrateDocument dispatches through injected future migrations in order");

// ── 6. A migration that fails to advance the version is rejected ──
assert.throws(
  () =>
    migrateDocument({ schemaVersion: 1 }, {
      targetVersion: 2,
      migrations: { 1: (d) => ({ ...d, schemaVersion: 1 }) },
    }),
  SchemaError,
);
console.log("ok - migrateDocument rejects a migration that does not advance the version");

// ── 7. State document factory ──
const state = createStateDocument();
assert.equal(state.schemaVersion, 1);
assert.equal(state.activeSpec, null);
assert.equal(state.phase, null);
assert.equal(state.branch, null);
assert.equal(state.lastSessionId, null);
assert.equal(state.pendingWork, null);
assert.equal(state.checks, null);
assert.ok(typeof state.updatedAt === "string");

const stateOverride = createStateDocument({
  branch: "spec/10-x",
  activeSpec: { number: 10, title: "t" },
  phase: "in-progress",
});
assert.equal(stateOverride.schemaVersion, 1);
assert.equal(stateOverride.branch, "spec/10-x");
assert.deepEqual(stateOverride.activeSpec, { number: 10, title: "t" });
assert.equal(stateOverride.phase, "in-progress");
console.log("ok - createStateDocument stamps schemaVersion and fills documented defaults");

// ── 8. Session document factory (nested provenance preserved) ──
const session = createSessionDocument({ sessionId: "abc-123" });
assert.equal(session.schemaVersion, 1);
assert.equal(session.sessionId, "abc-123");
assert.deepEqual(session.changedFiles, []);
assert.equal(session.summary, null);
assert.equal(session.outcome, null);
assert.equal(session.workflow, null);
assert.equal(session.checkResults, null);
assert.equal(session.usage, null);
assert.deepEqual(session.provenance, {
  piConfigCommit: null,
  piVersion: null,
  piSessionFormatVersion: null,
  productVersion: null,
  configHash: null,
});
console.log("ok - createSessionDocument stamps schemaVersion with nested provenance defaults");
