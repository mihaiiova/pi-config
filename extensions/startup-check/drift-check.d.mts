export type Verdict = "both" | "sync" | "reload" | "none";

export interface PackageDiff {
  missing: string[];
  extras: string[];
}

export interface FingerprintFile {
  path: string;
  hash: string;
}

export interface DriftVerdictInput {
  localHead: string | null | undefined;
  remoteHead: string | null | undefined;
  installedPackages: Array<string | { source: string }>;
  desiredPackages: string[];
  changedFileMarker: boolean;
}

export interface DriftVerdict {
  verdict: Verdict;
}

export function diffPackages(
  desiredPackages: string[],
  installedPackages: Array<string | { source: string }>,
): PackageDiff;
export function fingerprintFiles(files: FingerprintFile[]): string;
export function computeReloadSignal(
  currentFiles: FingerprintFile[],
  loadedFingerprint: string | null | undefined,
): boolean;
export function computeVerdict(input: DriftVerdictInput): DriftVerdict;
