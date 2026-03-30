import type { TFile, Vault } from "obsidian";
import {
  SHARED_STYLES_SLUG,
  WRITINGS_ROOT
} from "../constants";
import { loadRequestIndex } from "./requests";
import { readWorkspaceReviewState } from "./workspace";
import type {
  ProjectDiscoveryResult,
  ProjectEntryType,
  ProjectValidationIssue,
  WorkspaceProjectPaths
} from "./types";

interface RequiredProjectEntry {
  path: string;
  expected: Exclude<ProjectEntryType, "missing">;
}

function normalizeProjectPath(path: string): string {
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
  if (!activePath) {
    return null;
  }

  const normalizedPath = normalizeProjectPath(activePath);
  const segments = normalizedPath.split("/").filter(Boolean);

  if (segments.length < 2 || segments[0] !== WRITINGS_ROOT) {
    return null;
  }

  const slug = segments[1];

  if (!slug || slug === SHARED_STYLES_SLUG) {
    return null;
  }

  return `${WRITINGS_ROOT}/${slug}`;
}

export function getWorkspaceProjectPaths(projectRoot: string): WorkspaceProjectPaths {
  const normalizedRoot = normalizeProjectPath(projectRoot);

  return {
    root: normalizedRoot,
    canonicalPath: `${normalizedRoot}/draft.md`,
    shadowPath: `${normalizedRoot}/draft.shadow.md`,
    projectPath: `${normalizedRoot}/project.md`,
    resourcesPath: `${normalizedRoot}/resources`,
    requestsPath: `${normalizedRoot}/requests`
  };
}

export function validateProjectStructure(
  paths: WorkspaceProjectPaths,
  getPathType: (path: string) => ProjectEntryType
): ProjectValidationIssue[] {
  const requiredEntries: RequiredProjectEntry[] = [
    { path: paths.canonicalPath, expected: "file" },
    { path: paths.shadowPath, expected: "file" },
    { path: paths.projectPath, expected: "file" },
    { path: paths.resourcesPath, expected: "folder" },
    { path: paths.requestsPath, expected: "folder" }
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
      message:
        "Open a note inside writings/<slug>/ to load a writing project in the Review pane."
    };
  }

  const projectRoot = findProjectRootFromPath(activeFile.path);

  if (!projectRoot) {
    return {
      status: "invalid",
      activeFilePath: activeFile.path,
      message:
        "The active note is not inside a writing project under writings/<slug>/."
    };
  }

  const paths = getWorkspaceProjectPaths(projectRoot);
  const issues = validateProjectStructure(paths, (path) =>
    getEntryType(vault.getAbstractFileByPath(path))
  );

  if (issues.length > 0) {
    return {
      status: "invalid",
      activeFilePath: activeFile.path,
      projectRoot,
      issues,
      message: `This writing project is incomplete: ${listMissingPaths(issues)}.`
    };
  }

  let requests;
  let review;

  try {
    review = await readWorkspaceReviewState(vault, paths);
  } catch (error) {
    return {
      status: "invalid",
      activeFilePath: activeFile.path,
      projectRoot,
      message:
        error instanceof Error
          ? `Could not load review files: ${error.message}`
          : "Could not load review files."
    };
  }

  try {
    requests = await loadRequestIndex(vault, paths.requestsPath);
  } catch (error) {
    return {
      status: "invalid",
      activeFilePath: activeFile.path,
      projectRoot,
      message:
        error instanceof Error
          ? `Could not load request metadata: ${error.message}`
          : "Could not load request metadata."
    };
  }

  return {
    status: "ready",
    message: `Reviewing ${projectRoot}. Found ${requests.records.length} request record${
      requests.records.length === 1 ? "" : "s"
    }.`,
    project: {
      slug: projectRoot.split("/")[1] ?? projectRoot,
      root: projectRoot,
      activeFilePath: activeFile.path,
      paths,
      review,
      requests
    }
  };
}
