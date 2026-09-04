export interface SyncResult {
  steps: string[];
  error?: string;
  needsHelp?: boolean;
  conflictFiles?: string[];
  dirtyFiles?: string[];
}

export interface GitClient {
  commitAllChanges(): string;
  getDirtyFiles(): string[];
  syncClean(): SyncResult;
}

export function createGitClient(repoPath: string): GitClient;
