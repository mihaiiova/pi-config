export function deriveActiveSpec(
  branch: string | null | undefined,
): { number: number } | null;
export function parseSpecPhase(
  labels: string[] | null | undefined,
): string | null;
export function parseChangedFiles(
  porcelain: string | null | undefined,
): string[];
