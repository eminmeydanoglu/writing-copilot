import path from "node:path";
import type { WorkspacePaths } from "@/src/lib/workspace/types";

const DEFAULT_ROOT = path.join(process.cwd(), "data", "workspace");

export function getWorkspaceRoot(): string {
  return process.env.WRITING_COPILOT_WORKSPACE_DIR ?? DEFAULT_ROOT;
}

export function getWorkspacePaths(): WorkspacePaths {
  const root = getWorkspaceRoot();

  return {
    root,
    canonicalPath: path.join(root, "draft.md"),
    shadowPath: path.join(root, "draft.shadow.md"),
    versionsPath: path.join(root, "versions.json")
  };
}
