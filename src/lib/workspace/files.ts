import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyHunkDecisionSet, diffDocuments } from "@/src/lib/workspace/diff";
import type {
  ReviewDecision,
  WorkspaceVersion,
  WorkspacePaths,
  WorkspaceState
} from "@/src/lib/workspace/types";

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

async function ensureParent(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function readIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

function parseVersions(raw: string, versionsPath: string): WorkspaceVersion[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid workspace versions file at ${versionsPath}`, {
      cause: error
    });
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid workspace versions file at ${versionsPath}`);
  }

  return parsed as WorkspaceVersion[];
}

let workspaceMutationQueue = Promise.resolve();

function queueWorkspaceMutation<T>(task: () => Promise<T>): Promise<T> {
  const nextTask = workspaceMutationQueue.then(task, task);
  workspaceMutationQueue = nextTask.then(
    () => undefined,
    () => undefined
  );
  return nextTask;
}

async function readVersions(
  paths: WorkspacePaths
): Promise<WorkspaceVersion[] | null> {
  try {
    const raw = await readFile(paths.versionsPath, "utf8");
    return parseVersions(raw, paths.versionsPath);
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

async function loadVersions(paths: WorkspacePaths): Promise<WorkspaceVersion[]> {
  const versions = await readVersions(paths);
  return versions ?? [];
}

function getInitialCanonicalContent(
  existingCanonical: string | null,
  initialContent: string
): string {
  return existingCanonical ?? initialContent;
}

async function ensureInitialVersion(
  paths: WorkspacePaths,
  canonicalContent: string
): Promise<void> {
  const initialVersion = createVersionRecord(
    canonicalContent,
    "initial",
    "Initial draft"
  );
  await writeVersions(paths, [initialVersion]);
  const initialVersionPath = getVersionPath(paths, initialVersion.id);
  await ensureParent(initialVersionPath);
  await writeFile(initialVersionPath, canonicalContent, "utf8");
}

async function writeCanonicalAndShadow(
  paths: WorkspacePaths,
  canonical: string,
  shadow: string,
  options?: {
    source?: WorkspaceVersion["source"];
    label?: string;
    forceVersion?: boolean;
  }
): Promise<void> {
  await queueWorkspaceMutation(async () => {
    await ensureParent(paths.canonicalPath);
    await writeFile(paths.canonicalPath, canonical, "utf8");
    await recordVersionIfChanged(
      paths,
      canonical,
      options?.source ?? "manual",
      options?.label ?? "Manual save",
      {
        force: options?.forceVersion
      }
    );
    await ensureParent(paths.shadowPath);
    await writeFile(paths.shadowPath, shadow, "utf8");
  });
}

async function readVersionContent(
  paths: WorkspacePaths,
  versionId: string
): Promise<string> {
  return readFile(getVersionPath(paths, versionId), "utf8");
}

function buildVersionPreview(content: string): string {
  return content
    .replace(/^#\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function createVersionRecord(
  content: string,
  source: WorkspaceVersion["source"],
  label: string
): WorkspaceVersion {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    label,
    source,
    preview: buildVersionPreview(content) || "Empty draft"
  };
}

function getVersionPath(paths: WorkspacePaths, versionId: string): string {
  return path.join(paths.root, "versions", `${versionId}.md`);
}

async function writeVersions(
  paths: WorkspacePaths,
  versions: WorkspaceVersion[]
): Promise<void> {
  await ensureParent(paths.versionsPath);
  await writeFile(paths.versionsPath, JSON.stringify(versions, null, 2), "utf8");
}

async function recordVersionIfChanged(
  paths: WorkspacePaths,
  content: string,
  source: WorkspaceVersion["source"],
  label: string,
  options?: { force?: boolean }
): Promise<WorkspaceVersion[]> {
  const versions = await loadVersions(paths);

  if (!options?.force && versions[0]?.preview === buildVersionPreview(content)) {
    const current = await readVersionContent(paths, versions[0].id).catch(
      () => null
    );

    if (current === content) {
      return versions;
    }
  }

  const version = createVersionRecord(content, source, label);
  const filePath = getVersionPath(paths, version.id);
  await ensureParent(filePath);
  await writeFile(filePath, content, "utf8");

  const nextVersions = [version, ...versions];
  await writeVersions(paths, nextVersions);
  return nextVersions;
}

export async function ensureWorkspace(
  paths: WorkspacePaths,
  initialContent = ""
): Promise<void> {
  const existingCanonical = await readIfExists(paths.canonicalPath);
  const existingShadow = await readIfExists(paths.shadowPath);
  const versions = await loadVersions(paths);
  const canonicalContent = getInitialCanonicalContent(
    existingCanonical,
    initialContent
  );

  if (existingCanonical === null) {
    await ensureParent(paths.canonicalPath);
    await writeFile(paths.canonicalPath, canonicalContent, "utf8");
  }

  if (existingShadow === null) {
    await ensureParent(paths.shadowPath);
    await writeFile(paths.shadowPath, canonicalContent, "utf8");
  }

  if (versions.length === 0) {
    await ensureInitialVersion(paths, canonicalContent);
  }
}

export async function writeCanonical(
  paths: WorkspacePaths,
  content: string,
  options?: {
    source?: WorkspaceVersion["source"];
    label?: string;
    forceVersion?: boolean;
  }
): Promise<void> {
  await queueWorkspaceMutation(async () => {
    await ensureParent(paths.canonicalPath);
    await writeFile(paths.canonicalPath, content, "utf8");
    await recordVersionIfChanged(
      paths,
      content,
      options?.source ?? "manual",
      options?.label ?? "Manual save",
      {
        force: options?.forceVersion
      }
    );
  });
}

export async function writeShadow(
  paths: WorkspacePaths,
  content: string
): Promise<void> {
  await ensureParent(paths.shadowPath);
  await writeFile(paths.shadowPath, content, "utf8");
}

export async function syncShadow(paths: WorkspacePaths): Promise<void> {
  const canonical = await readFile(paths.canonicalPath, "utf8");
  await writeFile(paths.shadowPath, canonical, "utf8");
}

export async function readWorkspace(paths: WorkspacePaths): Promise<WorkspaceState> {
  await ensureWorkspace(paths);
  const canonical = await readFile(paths.canonicalPath, "utf8");
  const shadow = await readFile(paths.shadowPath, "utf8");

  return {
    canonical,
    shadow,
    hunks: diffDocuments(canonical, shadow),
    versions: await loadVersions(paths)
  };
}

export async function reviewWorkspace(
  paths: WorkspacePaths,
  decisions: Partial<Record<string, ReviewDecision>>
): Promise<WorkspaceState> {
  await ensureWorkspace(paths);
  const current = await readWorkspace(paths);

  if (Object.keys(decisions).length === 0) {
    return current;
  }

  const reviewed = applyHunkDecisionSet(
    current.canonical,
    current.shadow,
    current.hunks,
    decisions
  );
  const reviewComplete =
    diffDocuments(reviewed.canonical, reviewed.shadow).length === 0;
  const canonicalChanged = reviewed.canonical !== current.canonical;
  const shadowChanged = reviewed.shadow !== current.shadow;

  if (canonicalChanged) {
    await writeCanonical(paths, reviewed.canonical, {
      source: "review",
      label: "Applied reviewed changes"
    });
  }

  if (reviewComplete) {
    await syncShadow(paths);
  } else if (shadowChanged) {
    await writeShadow(paths, reviewed.shadow);
  }

  return readWorkspace(paths);
}

export async function restoreVersion(
  paths: WorkspacePaths,
  versionId: string
): Promise<WorkspaceState> {
  const content = await readVersionContent(paths, versionId);
  await writeCanonicalAndShadow(paths, content, content, {
    source: "restore",
    label: "Restored an earlier version",
    forceVersion: true
  });
  return readWorkspace(paths);
}
