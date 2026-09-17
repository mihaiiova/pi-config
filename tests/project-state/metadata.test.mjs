import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  aggregateUsage,
  readProductVersion,
  configHash,
  readPiConfigCommit,
  collectProvenance,
} from "../../extensions/project-state/metadata.mjs";

const temp = mkdtempSync(join(tmpdir(), "project-state-meta-"));

// ── 1. aggregateUsage returns null when nothing reports usage ──
assert.equal(aggregateUsage([]), null);
assert.equal(aggregateUsage([{ type: "message", message: { role: "user" } }]), null);
console.log("ok - aggregateUsage is null when no entry reports usage");

// ── 2. aggregateUsage sums assistant, compaction, and branch-summary usage ──
const usageOf = (n) => ({
  input: n,
  output: n * 2,
  cacheRead: n,
  cacheWrite: 0,
  totalTokens: n * 3,
  cost: { input: n, output: n * 2, cacheRead: n, cacheWrite: 0, total: n * 3 },
});
const entries = [
  { type: "message", message: { role: "assistant", usage: usageOf(10) } },
  { type: "message", message: { role: "assistant", usage: usageOf(5) } },
  { type: "compaction", summary: "x", usage: usageOf(2) },
  { type: "branch_summary", summary: "y", usage: usageOf(3) },
  // Nested tool/model usage is intentionally excluded (not the main agent).
  { type: "message", message: { role: "toolResult", usage: usageOf(100) } },
];
const total = aggregateUsage(entries);
assert.equal(total.input, 20);
assert.equal(total.output, 40);
assert.equal(total.cacheRead, 20);
assert.equal(total.totalTokens, 60);
assert.equal(total.cost.total, 60);
assert.equal(total.cost.input, 20);
console.log("ok - aggregateUsage sums main-agent usage and excludes nested tool usage");

// ── 3. aggregateUsage tolerates missing/partial fields ──
const partial = aggregateUsage([
  { type: "message", message: { role: "assistant", usage: { totalTokens: 7, cost: { total: 0.5 } } } },
]);
assert.equal(partial.input, 0);
assert.equal(partial.output, 0);
assert.equal(partial.totalTokens, 7);
assert.equal(partial.cost.total, 0.5);
assert.equal(partial.cost.input, 0);
console.log("ok - aggregateUsage defaults missing usage fields to zero");

// ── 4. readProductVersion prefers the configured version file, falls back to package.json ──
const proj = join(temp, "proj");
mkdirSync(proj, { recursive: true });
writeFileSync(join(proj, "package.json"), JSON.stringify({ version: "1.2.3" }));
assert.equal(readProductVersion(proj, undefined), "1.2.3");
assert.equal(readProductVersion(proj, "package.json"), "1.2.3");

writeFileSync(join(proj, "pyproject.toml"), "version = \"9.9.9\"");
assert.equal(readProductVersion(proj, "package.json"), "1.2.3"); // explicit file wins

const empty = join(temp, "empty");
mkdirSync(empty, { recursive: true });
assert.equal(readProductVersion(empty, undefined), null);
console.log("ok - readProductVersion reads the product version and returns null when absent");

// ── 5. configHash is a stable digest over the active project configuration ──
const cfgPi = join(temp, "cfg-pi");
mkdirSync(cfgPi, { recursive: true });
writeFileSync(join(cfgPi, "pi-config.json"), JSON.stringify({ tiers: { high: "a" } }));
writeFileSync(join(cfgPi, "settings.json"), JSON.stringify({ spec: { baseBranch: "development" } }));
const h1 = configHash(cfgPi);
assert.match(h1, /^[0-9a-f]{64}$/);
assert.equal(configHash(cfgPi), h1);

// Same content, different directory → same hash (stable labels, not paths).
const cfgPi2 = join(temp, "cfg-pi-2");
mkdirSync(cfgPi2, { recursive: true });
writeFileSync(join(cfgPi2, "pi-config.json"), JSON.stringify({ tiers: { high: "a" } }));
writeFileSync(join(cfgPi2, "settings.json"), JSON.stringify({ spec: { baseBranch: "development" } }));
assert.equal(configHash(cfgPi2), h1);

writeFileSync(join(cfgPi, "settings.json"), JSON.stringify({ spec: { baseBranch: "main" } }));
assert.notEqual(configHash(cfgPi), h1);

const noCfg = join(temp, "no-cfg");
mkdirSync(noCfg, { recursive: true });
assert.equal(configHash(noCfg), null);
console.log("ok - configHash is a stable content digest, independent of directory, null when absent");

// ── 6. readPiConfigCommit returns HEAD in a git repo and null otherwise ──
const gitRepo = join(temp, "pi-config-repo");
mkdirSync(gitRepo, { recursive: true });
execFileSync("git", ["init", "-q", gitRepo]);
execFileSync("git", ["-C", gitRepo, "config", "user.email", "meta@example.invalid"]);
execFileSync("git", ["-C", gitRepo, "config", "user.name", "Meta Test"]);
writeFileSync(join(gitRepo, "x.txt"), "x");
execFileSync("git", ["-C", gitRepo, "add", "x.txt"]);
execFileSync("git", ["-C", gitRepo, "commit", "-q", "-m", "init"]);
const head = execFileSync("git", ["-C", gitRepo, "rev-parse", "HEAD"], { encoding: "utf-8" }).trim();
assert.equal(readPiConfigCommit(gitRepo), head);
assert.equal(readPiConfigCommit(join(temp, "not-a-repo")), null);
console.log("ok - readPiConfigCommit returns HEAD sha or null");

// ── 7. collectProvenance assembles all fields with nulls for unavailable facts ──
const provenance = collectProvenance({
  piConfigRoot: gitRepo,
  cwd: proj,
  piDir: cfgPi,
  versionFile: undefined,
  piVersion: "0.0.0-test",
  piSessionFormatVersion: 3,
});
assert.equal(provenance.piConfigCommit, head);
assert.equal(provenance.piVersion, "0.0.0-test");
assert.equal(provenance.piSessionFormatVersion, 3);
assert.equal(provenance.productVersion, "1.2.3");
assert.equal(provenance.configHash, configHash(cfgPi)); // current config content

const minimal = collectProvenance({});
assert.equal(minimal.piConfigCommit, null);
assert.equal(minimal.piVersion, null);
assert.equal(minimal.piSessionFormatVersion, null);
assert.equal(minimal.productVersion, null);
assert.equal(minimal.configHash, null);
console.log("ok - collectProvenance fills reliable facts and leaves unavailable ones null");
