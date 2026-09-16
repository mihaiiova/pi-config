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
