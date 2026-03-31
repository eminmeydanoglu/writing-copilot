import type { TFile, Vault } from "obsidian";
import { indexRequestRecords, loadRequestIndex } from "./requests";
import { readWorkspaceReviewState } from "./workspace";
import type {
  ProjectDiscoveryResult,
  ProjectEntryType,
  ProjectValidationIssue,
  WorkspaceProjectPaths
} from "./types";

interface RequiredWorkspaceEntry {
  path: string;
  expected: Exclude<ProjectEntryType, "missing">;
}

function normalizeWorkspacePath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/$/, "");
}

function getEntryType(entry: unknown): ProjectEntryType {
  if (!entry || typeof entry !== "object") {
    return "missing";
  }

  const candidate = entry as {
    children?: unknown;
    stat?: unknown;
    extension?: unknown;
  };

  if (Array.isArray(candidate.children)) {
    return "folder";
  }

  if ("stat" in candidate || typeof candidate.extension === "string") {
    return "file";
  }

  return "missing";
}

function getParentDirectory(path: string): string {
  const normalizedPath = normalizeWorkspacePath(path);
  const separatorIndex = normalizedPath.lastIndexOf("/");

  return separatorIndex >= 0 ? normalizedPath.slice(0, separatorIndex) : "";
}

function getFileStem(path: string): string {
  const normalizedPath = normalizeWorkspacePath(path);
  const fileName = normalizedPath.slice(normalizedPath.lastIndexOf("/") + 1);

  return fileName.endsWith(".md") ? fileName.slice(0, -3) : fileName;
}

function joinPath(directory: string, fileName: string): string {
  return directory ? `${directory}/${fileName}` : fileName;
}

function isMarkdownNotePath(path: string | null): path is string {
  return typeof path === "string" && normalizeWorkspacePath(path).endsWith(".md");
}

function listMissingPaths(issues: ProjectValidationIssue[]): string {
  return issues
    .map((issue) => {
      if (issue.code === "missing-required-path") {
        return `${issue.path} (${issue.expected})`;
      }

      return `${issue.path} (expected ${issue.expected}, found ${issue.actual})`;
    })
    .join(", ");
}

export function findProjectRootFromPath(activePath: string | null): string | null {
  if (!isMarkdownNotePath(activePath)) {
    return null;
  }

  return getParentDirectory(normalizeWorkspacePath(activePath));
}

export function getWorkspaceProjectPaths(activePath: string): WorkspaceProjectPaths | null {
  if (!isMarkdownNotePath(activePath)) {
    return null;
  }

  const canonicalPath = normalizeWorkspacePath(activePath);
  const root = getParentDirectory(canonicalPath);
  const stem = getFileStem(canonicalPath);

  return {
    root,
    canonicalPath,
    shadowPath: joinPath(root, `${stem}.shadow`),
    requestsPath: joinPath(root, "requests")
  };
}

export function validateProjectStructure(
  paths: WorkspaceProjectPaths,
  getPathType: (path: string) => ProjectEntryType
): ProjectValidationIssue[] {
  const requiredEntries: RequiredWorkspaceEntry[] = [
    { path: paths.canonicalPath, expected: "file" },
    { path: paths.shadowPath, expected: "file" }
  ];

  return requiredEntries.reduce<ProjectValidationIssue[]>((issues, entry) => {
    const actual = getPathType(entry.path);

    if (actual === "missing") {
      issues.push({
        code: "missing-required-path",
        path: entry.path,
        expected: entry.expected,
        actual
      });

      return issues;
    }

    if (actual !== entry.expected) {
      issues.push({
        code: "invalid-path-type",
        path: entry.path,
        expected: entry.expected,
        actual
      });
    }

    return issues;
  }, []);
}

export async function discoverWorkspaceProject(
  vault: Vault,
  activeFile: TFile | null
): Promise<ProjectDiscoveryResult> {
  if (!activeFile) {
    return {
      status: "empty",
      message: "Open a Markdown note to enter diff review mode."
    };
  }

  const paths = getWorkspaceProjectPaths(activeFile.path);

  if (!paths) {
    return {
      status: "invalid",
      activeFilePath: activeFile.path,
      message: "Open a Markdown note to enter diff review mode."
    };
  }

  const issues = validateProjectStructure(paths, (path) =>
    getEntryType(vault.getAbstractFileByPath(path))
  );

  if (issues.length > 0) {
    return {
      status: "invalid",
      activeFilePath: activeFile.path,
      projectRoot: paths.root,
      issues,
      message: `This note pair is incomplete: ${listMissingPaths(issues)}.`
    };
  }

  let review;

  try {
    review = await readWorkspaceReviewState(vault, paths);
  } catch (error) {
    return {
      status: "invalid",
      activeFilePath: activeFile.path,
      projectRoot: paths.root,
      message:
        error instanceof Error
          ? `Could not load review files: ${error.message}`
          : "Could not load review files."
    };
  }

  const requests = await loadRequestIndex(vault, paths.requestsPath).catch(() =>
    indexRequestRecords([])
  );

  const slug = getFileStem(paths.canonicalPath);
  const workspaceLabel = paths.root
    ? `${paths.root}/${slug}.md`
    : `${slug}.md`;

  return {
    status: "ready",
    message: `Reviewing ${workspaceLabel}. Found ${requests.records.length} request record${
      requests.records.length === 1 ? "" : "s"
    }.`,
    project: {
      slug,
      root: paths.root,
      activeFilePath: activeFile.path,
      paths,
      review,
      requests
    }
  };
}
