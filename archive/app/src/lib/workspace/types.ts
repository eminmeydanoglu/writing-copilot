export type ReviewDecision = "accept" | "reject";

export interface WorkspacePaths {
  root: string;
  canonicalPath: string;
  shadowPath: string;
  versionsPath: string;
}

export interface DiffSegment {
  type: "added" | "removed";
  value: string;
}

export interface DiffHunk {
  id: string;
  kind: "added" | "removed" | "modified";
  canonicalStartLine: number;
  shadowStartLine: number;
  segments: DiffSegment[];
}

export interface WorkspaceState {
  canonical: string;
  shadow: string;
  hunks: DiffHunk[];
  versions: WorkspaceVersion[];
}

export interface WorkspaceVersion {
  id: string;
  createdAt: string;
  label: string;
  source: "initial" | "manual" | "review" | "restore";
  preview: string;
}
