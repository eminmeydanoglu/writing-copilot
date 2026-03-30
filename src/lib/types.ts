export type ReviewDecision = "accept" | "reject";
export type ReviewDecisionSet = Partial<Record<string, ReviewDecision>>;

export type KnownRequestStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "reviewed";

export type RequestStatus = KnownRequestStatus | (string & {});

export type DiffSegmentType = "context" | "added" | "removed";

export interface DiffSegment {
  type: DiffSegmentType;
  text: string;
}

export type DiffHunkKind = "added" | "removed" | "modified";

export interface DiffHunk {
  id: string;
  kind: DiffHunkKind;
  canonicalStartLine: number;
  canonicalLineCount: number;
  shadowStartLine: number;
  shadowLineCount: number;
  segments: DiffSegment[];
}

export interface WorkspaceProjectPaths {
  root: string;
  canonicalPath: string;
  shadowPath: string;
  projectPath: string;
  resourcesPath: string;
  requestsPath: string;
}

export interface WorkspaceReviewState {
  canonical: string;
  shadow: string;
  hunks: DiffHunk[];
}

export interface RequestRecord {
  id: string;
  agent: string;
  title: string;
  task: string;
  createdAt: string;
  status: RequestStatus;
  shadowRevision: string;
  sourcePath: string;
  bodyPath?: string;
  notesPath?: string;
  resultPath?: string;
  acceptedCount?: number;
  rejectedCount?: number;
}

export interface RequestRecordIndex {
  records: RequestRecord[];
  byId: Record<string, RequestRecord>;
  latest: RequestRecord | null;
}

export interface WorkspaceProject {
  slug: string;
  root: string;
  activeFilePath: string;
  paths: WorkspaceProjectPaths;
  review: WorkspaceReviewState;
  requests: RequestRecordIndex;
}

export type ProjectEntryType = "file" | "folder" | "missing";

export interface ProjectValidationIssue {
  code: "missing-required-path" | "invalid-path-type";
  path: string;
  expected: Exclude<ProjectEntryType, "missing">;
  actual: ProjectEntryType;
}

export interface ProjectDiscoveryEmptyState {
  status: "empty";
  message: string;
}

export interface ProjectDiscoveryInvalidState {
  status: "invalid";
  message: string;
  activeFilePath: string | null;
  projectRoot?: string;
  issues?: ProjectValidationIssue[];
}

export interface ProjectDiscoveryReadyState {
  status: "ready";
  message: string;
  project: WorkspaceProject;
}

export type ProjectDiscoveryResult =
  | ProjectDiscoveryEmptyState
  | ProjectDiscoveryInvalidState
  | ProjectDiscoveryReadyState;
