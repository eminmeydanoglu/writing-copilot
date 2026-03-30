import type { DiffHunk } from "./types";

export type DiffModeRole = "canonical" | "shadow";

export interface DiffModeSnapshot {
  projectRoot: string;
  canonicalPath: string;
  shadowPath: string;
  hunks: DiffHunk[];
  selectedHunkId: string | null;
  isApplying: boolean;
}

export function getHunkLineRange(
  hunk: DiffHunk,
  role: DiffModeRole
): { startLine: number; endLine: number } | null {
  const startLine =
    role === "canonical" ? hunk.canonicalStartLine : hunk.shadowStartLine;
  const lineCount =
    role === "canonical" ? hunk.canonicalLineCount : hunk.shadowLineCount;

  if (lineCount <= 0) {
    return null;
  }

  return {
    startLine,
    endLine: startLine + lineCount - 1
  };
}

export function findHunkIdAtLine(
  hunks: DiffHunk[],
  role: DiffModeRole,
  lineNumber: number
): string | null {
  const match = hunks.find((hunk) => {
    const range = getHunkLineRange(hunk, role);

    return !!range && lineNumber >= range.startLine && lineNumber <= range.endLine;
  });

  return match?.id ?? null;
}

export function ensureSelectedHunkId(
  hunks: DiffHunk[],
  selectedHunkId: string | null
): string | null {
  if (!selectedHunkId) {
    return hunks[0]?.id ?? null;
  }

  return hunks.some((hunk) => hunk.id === selectedHunkId)
    ? selectedHunkId
    : hunks[0]?.id ?? null;
}

export function getSelectedHunkIndex(
  hunks: DiffHunk[],
  selectedHunkId: string | null
): number {
  if (!selectedHunkId) {
    return -1;
  }

  return hunks.findIndex((hunk) => hunk.id === selectedHunkId);
}
