/**
 * startup-check — detect pi-config drift on session start
 *
 * Compares the local repo against origin/HEAD, reconciles installed pi
 * packages against pi.packages, and detects changed extension/skill files
 * since the last startup/reload. Emits a single non-blocking warning telling
 * the user which command (/pi-sync, /reload, or both) is needed.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeReloadSignal,
  computeVerdict,
  diffPackages,
  fingerprintFiles,
} from "./drift-check.mjs";

// ── Config ────────────────────────────────────────────────────

// Derive the repo root from this extension's own location instead of a
// hardcoded path — pi-config is cloned to different locations per machine.
const REPO_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SETTINGS_PATH = resolve(process.env.HOME!, ".pi/agent/settings.json");
const MARKER_PATH = resolve(
  process.env.HOME!,
  ".pi/agent/pi-config-drift-marker.json",
);

// ── Git helpers ───────────────────────────────────────────────

function gitSafe(args: string[]): string | null {
  try {
    return execFileSync("git", ["-C", REPO_PATH, ...args], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function isOffline(): boolean {
  const v = process.env.PI_OFFLINE ?? process.env.PI_SKIP_VERSION_CHECK;
  return v === "1" || v === "true" || v === "yes";
}

function getGitHeads(): { localHead: string | null; remoteHead: string | null } {
  if (isOffline()) {
    return { localHead: gitSafe(["rev-parse", "HEAD"]), remoteHead: null };
  }
  gitSafe(["fetch", "--quiet"]);
  return {
    localHead: gitSafe(["rev-parse", "HEAD"]),
    remoteHead: gitSafe(["rev-parse", "origin/HEAD"]),
  };
}

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

// ── File fingerprinting ───────────────────────────────────────

function walkDir(dir: string, out: { path: string; hash: string }[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.startsWith(".") || entry === "node_modules") continue;
    const full = join(dir, entry);

    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }

    if (st.isDirectory()) {
      walkDir(full, out);
    } else if (st.isFile()) {
      try {
        const hash = createHash("sha256").update(readFileSync(full)).digest("hex");
        out.push({ path: relative(REPO_PATH, full).split(sep).join("/"), hash });
      } catch {
        // Unreadable file — skip it rather than fail the whole snapshot.
      }
    }
  }
}

function buildSnapshot(): { path: string; hash: string }[] {
  const out: { path: string; hash: string }[] = [];
  for (const sub of ["extensions", "skills"]) {
    walkDir(join(REPO_PATH, sub), out);
  }
  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return out;
}

function readMarkerFingerprint(): string | null {
  try {
    if (!existsSync(MARKER_PATH)) return null;
    const raw = JSON.parse(readFileSync(MARKER_PATH, "utf-8"));
    return typeof raw?.fingerprint === "string" ? raw.fingerprint : null;
  } catch {
    return null;
  }
}

function writeMarker(fingerprint: string): void {
  try {
    mkdirSync(dirname(MARKER_PATH), { recursive: true });
    writeFileSync(
      MARKER_PATH,
      `${JSON.stringify({ fingerprint }, null, 2)}\n`,
      "utf-8",
    );
  } catch {
    // Marker is best-effort; never surface an error from session_start.
  }
}

// ── Extension ─────────────────────────────────────────────────

export default function startupCheck(pi: ExtensionAPI) {
  pi.on("session_start", (event, ctx) => {
    try {
      const snapshot = buildSnapshot();
      const storedFingerprint = readMarkerFingerprint();
      const reason = event.reason;

      let changedFileMarker = false;
      if (reason === "startup" || reason === "reload") {
        writeMarker(fingerprintFiles(snapshot));
      } else {
        changedFileMarker = computeReloadSignal(snapshot, storedFingerprint);
      }

      const { localHead, remoteHead } = getGitHeads();
      const { verdict } = computeVerdict({
        localHead,
        remoteHead,
        installedPackages: getInstalledPackages(),
        desiredPackages: getDesiredPackages(),
        changedFileMarker,
      });

      if (verdict === "sync") {
        ctx.ui.notify("Pi config is out of sync. Run /pi-sync.", "warning");
      } else if (verdict === "reload") {
        ctx.ui.notify("Pi config files changed. Run /reload.", "warning");
      } else if (verdict === "both") {
        ctx.ui.notify(
          "Pi config is out of sync and files changed. Run /pi-sync then /reload.",
          "warning",
        );
      }
    } catch {
      // session_start must never throw.
    }
  });
}
