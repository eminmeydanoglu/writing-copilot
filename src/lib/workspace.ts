import type { TAbstractFile, TFile, Vault } from "obsidian";
import { diffDocuments } from "./diff";
import { applyReviewDecisionSet } from "./review";
import type {
  DiffHunk,
  ReviewDecisionSet,
  WorkspaceProjectPaths,
  WorkspaceReviewState
} from "./types";

function isFile(entry: TAbstractFile | null): entry is TFile {
  return !!entry && typeof (entry as TFile).extension === "string";
}

function getRequiredFile(vault: Vault, path: string): TFile {
  const file = vault.getAbstractFileByPath(path);

  if (!isFile(file)) {
    throw new Error(`Required file is missing: ${path}`);
  }

  return file;
}

async function readFreshText(vault: Vault, file: TFile): Promise<string> {
  return vault.read(file);
}

export async function readWorkspaceReviewState(
  vault: Vault,
  paths: WorkspaceProjectPaths
): Promise<WorkspaceReviewState> {
  const canonicalFile = getRequiredFile(vault, paths.canonicalPath);
  const shadowFile = getRequiredFile(vault, paths.shadowPath);
  const canonical = await vault.cachedRead(canonicalFile);
  const shadow = await vault.cachedRead(shadowFile);

  return {
    canonical,
    shadow,
    hunks: diffDocuments(canonical, shadow)
  };
}

export async function applyWorkspaceReview(
  vault: Vault,
  paths: WorkspaceProjectPaths,
  decisions: ReviewDecisionSet,
  hunks?: DiffHunk[]
): Promise<WorkspaceReviewState> {
  const canonicalFile = getRequiredFile(vault, paths.canonicalPath);
  const shadowFile = getRequiredFile(vault, paths.shadowPath);
  const canonical = await readFreshText(vault, canonicalFile);
  const shadow = await readFreshText(vault, shadowFile);
  const currentHunks = hunks ?? diffDocuments(canonical, shadow);

  if (Object.keys(decisions).length === 0) {
    return {
      canonical,
      shadow,
      hunks: currentHunks
    };
  }

  const reviewed = applyReviewDecisionSet(
    canonical,
    shadow,
    decisions,
    currentHunks
  );

  let canonicalWritten = false;
  let shadowWritten = false;

  try {
    if (reviewed.canonical !== canonical) {
      await vault.modify(canonicalFile, reviewed.canonical);
      canonicalWritten = true;
    }

    if (reviewed.shadow !== shadow) {
      await vault.modify(shadowFile, reviewed.shadow);
      shadowWritten = true;
    }
  } catch (error) {
    const rollbackFailures: string[] = [];

    if (shadowWritten) {
      try {
        await vault.modify(shadowFile, shadow);
      } catch (rollbackError) {
        rollbackFailures.push(
          rollbackError instanceof Error
            ? rollbackError.message
            : "Unknown shadow rollback failure."
        );
      }
    }

    if (canonicalWritten) {
      try {
        await vault.modify(canonicalFile, canonical);
      } catch (rollbackError) {
        rollbackFailures.push(
          rollbackError instanceof Error
            ? rollbackError.message
            : "Unknown canonical rollback failure."
        );
      }
    }

    const baseMessage =
      error instanceof Error ? error.message : "Unknown workspace write failure.";

    if (rollbackFailures.length > 0) {
      throw new Error(
        `Could not persist review changes: ${baseMessage}. Rollback also failed: ${rollbackFailures.join(
          "; "
        )}`
      );
    }

    throw new Error(`Could not persist review changes: ${baseMessage}`);
  }

  return {
    canonical: reviewed.canonical,
    shadow: reviewed.shadow,
    hunks: reviewed.hunks
  };
}
