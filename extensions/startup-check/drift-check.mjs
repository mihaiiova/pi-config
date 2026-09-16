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
