import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function createGitClient(repoPath) {
  function git(args) {
    return execFileSync("git", ["-C", repoPath, ...args], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  }

  function gitSafe(args) {
    try {
      return { stdout: git(args), stderr: "", ok: true };
    } catch (error) {
      return {
        stdout: error.stdout?.trim() ?? "",
        stderr: error.stderr?.trim() ?? error.message,
        ok: false,
      };
    }
  }

  function getDirtyFiles() {
    const status = git(["status", "--porcelain=v1"]);
    return status ? status.split("\n") : [];
  }

  function hasConflicts() {
    return git(["diff", "--name-only", "--diff-filter=U"]).length > 0;
  }

  function isRebasing() {
    const gitDir = git(["rev-parse", "--git-dir"]);
    const absoluteGitDir = resolve(repoPath, gitDir);
    return (
      existsSync(resolve(absoluteGitDir, "rebase-merge")) ||
      existsSync(resolve(absoluteGitDir, "rebase-apply"))
    );
  }

  function commitAllChanges() {
    git(["add", "-A"]);
    git(["commit", "-m", "sync: commit confirmed before pull"]);
    return git(["log", "-1", "--format=%s"]);
  }

  function syncClean() {
    const steps = [];
    const dirtyFiles = getDirtyFiles();

    // This guard is the safety boundary for non-interactive callers. TUI callers
    // may commit first, but sync itself never commits an unexpected dirty tree.
    if (dirtyFiles.length > 0) {
      return { steps, dirtyFiles };
    }

    const fetch = gitSafe(["fetch", "--quiet"]);
    if (!fetch.ok) {
      return { steps, error: `fetch failed: ${fetch.stderr}` };
    }

    const pull = gitSafe(["pull", "--rebase", "--quiet"]);
    if (!pull.ok) {
      if (isRebasing() && hasConflicts()) {
        const conflictFiles = git([
          "diff",
          "--name-only",
          "--diff-filter=U",
        ]).split("\n");
        return { steps, needsHelp: true, conflictFiles };
      }
      return { steps, error: `pull failed: ${pull.stderr}` };
    }

    if (pull.stdout && !pull.stdout.includes("Already up to date")) {
      steps.push("pulled remote changes");
    }

    const push = gitSafe(["push", "--quiet"]);
    if (!push.ok) {
      return { steps, error: `push failed: ${push.stderr}` };
    }

    if (steps.length === 0) {
      steps.push("already up to date");
    }

    return { steps };
  }

  return { commitAllChanges, getDirtyFiles, syncClean };
}
