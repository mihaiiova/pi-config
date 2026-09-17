export function aggregateUsage(entries: unknown[]): Record<string, any> | null;
export function readProductVersion(
  cwd: string | undefined,
  versionFile: string | undefined,
): string | null;
export function configHash(piDir: string | undefined): string | null;
export function readPiConfigCommit(piConfigRoot: string): string | null;
export function collectSubagentUsage(
  sessionDir: string | null | undefined,
): {
  agents: Array<{ agent: string; runs: number; cost: number }>;
  totalCost: number;
} | null;
export function collectProvenance(input: {
  piConfigRoot?: string;
  cwd?: string;
  piDir?: string;
  versionFile?: string;
  piVersion?: string;
  piSessionFormatVersion?: number;
}): Record<string, any>;
