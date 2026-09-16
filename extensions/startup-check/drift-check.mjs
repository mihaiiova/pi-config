import { createHash } from "node:crypto";

export function diffPackages(desiredPackages, installedPackages) {
  const desired = new Set(desiredPackages ?? []);
  const installed = new Set(
    (installedPackages ?? [])
      .map((item) => (typeof item === "string" ? item : item?.source))
      .filter(
        (src) =>
          typeof src === "string" &&
          (src.startsWith("npm:") || src.startsWith("git:")),
      ),
  );

  const missing = [...desired].filter((p) => !installed.has(p)).sort();
  const extras = [...installed].filter((p) => !desired.has(p)).sort();

  return { missing, extras };
}

export function fingerprintFiles(files) {
  const lines = (files ?? [])
    .map((f) => `${f.path}:${f.hash}`)
    .sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

export function computeReloadSignal(currentFiles, loadedFingerprint) {
  if (loadedFingerprint == null) return false;
  return fingerprintFiles(currentFiles) !== loadedFingerprint;
}

export function computeVerdict({
  localHead,
  remoteHead,
  installedPackages,
  desiredPackages,
  changedFileMarker,
}) {
  const gitDrift = remoteHead != null && localHead !== remoteHead;
  const { missing, extras } = diffPackages(desiredPackages, installedPackages);
  const pkgDrift = missing.length > 0 || extras.length > 0;
  const sync = gitDrift || pkgDrift;
  const reload = changedFileMarker === true;

  let verdict;
  if (sync && reload) verdict = "both";
  else if (sync) verdict = "sync";
  else if (reload) verdict = "reload";
  else verdict = "none";

  return { verdict };
}
