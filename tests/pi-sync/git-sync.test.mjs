import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGitClient } from "../../extensions/pi-sync/git-sync.mjs";

function run(cwd, command, args) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

const temp = mkdtempSync(join(tmpdir(), "pi-sync-test-"));
const remote = join(temp, "remote.git");
const seed = join(temp, "seed");
const checkout = join(temp, "checkout");

run(temp, "git", ["init", "--bare", remote]);
run(temp, "git", ["clone", remote, seed]);
run(seed, "git", ["config", "user.email", "pi-sync-test@example.invalid"]);
run(seed, "git", ["config", "user.name", "Pi Sync Test"]);
writeFileSync(join(seed, "tracked.txt"), "initial\n");
run(seed, "git", ["add", "tracked.txt"]);
run(seed, "git", ["commit", "-m", "initial"]);
run(seed, "git", ["push", "-u", "origin", "HEAD"]);

run(temp, "git", ["clone", remote, checkout]);
run(checkout, "git", ["config", "user.email", "pi-sync-test@example.invalid"]);
run(checkout, "git", ["config", "user.name", "Pi Sync Test"]);

const client = createGitClient(checkout);
const clean = client.syncClean();
assert.equal(clean.error, undefined);
assert.equal(clean.dirtyFiles, undefined);
assert.deepEqual(clean.steps, ["already up to date"]);

const headBefore = run(checkout, "git", ["rev-parse", "HEAD"]);
writeFileSync(join(checkout, "tracked.txt"), "changed\n");
writeFileSync(join(checkout, "untracked secret.txt"), "do not commit\n");
run(checkout, "git", ["remote", "set-url", "origin", join(temp, "missing.git")]);

const dirty = client.syncClean();
assert.equal(dirty.error, undefined);
assert.ok(dirty.dirtyFiles.some((entry) => entry.endsWith("tracked.txt")));
assert.ok(
  dirty.dirtyFiles.some((entry) => entry.endsWith('"untracked secret.txt"')),
);
assert.equal(run(checkout, "git", ["rev-parse", "HEAD"]), headBefore);
assert.equal(run(checkout, "git", ["diff", "--cached", "--name-only"]), "");

console.log("ok - dirty non-interactive sync refuses without staging or committing");
