import { diffLines } from "diff";
import type { DiffHunk, DiffHunkKind, DiffSegment } from "./types";

interface PendingHunk {
  id: string;
  canonicalStartLine: number;
  shadowStartLine: number;
  segments: DiffSegment[];
}

function countLines(text: string): number {
  const matches = text.match(/[^\n]*\n|[^\n]+$/g);
  return matches?.length ?? 0;
}

function getHunkKind(segments: DiffSegment[]): DiffHunkKind {
  const hasAdded = segments.some((segment) => segment.type === "added");
  const hasRemoved = segments.some((segment) => segment.type === "removed");

  if (hasAdded && hasRemoved) {
    return "modified";
  }

  return hasAdded ? "added" : "removed";
}

function finalizePendingHunk(hunk: PendingHunk | null): DiffHunk[] {
  if (!hunk || hunk.segments.length === 0) {
    return [];
  }

  const canonicalLineCount = hunk.segments
    .filter((segment) => segment.type !== "added")
    .reduce((total, segment) => total + countLines(segment.text), 0);
  const shadowLineCount = hunk.segments
    .filter((segment) => segment.type !== "removed")
    .reduce((total, segment) => total + countLines(segment.text), 0);

  return [
    {
      id: hunk.id,
      kind: getHunkKind(hunk.segments),
      canonicalStartLine: hunk.canonicalStartLine,
      canonicalLineCount,
      shadowStartLine: hunk.shadowStartLine,
      shadowLineCount,
      segments: hunk.segments
    }
  ];
}

export function diffDocuments(canonical: string, shadow: string): DiffHunk[] {
  const changes = diffLines(canonical, shadow);
  const hunks: DiffHunk[] = [];
  let canonicalLine = 1;
  let shadowLine = 1;
  let hunkIndex = 0;
  let pendingHunk: PendingHunk | null = null;

  for (const change of changes) {
    const lineCount = countLines(change.value);

    if (!change.added && !change.removed) {
      hunks.push(...finalizePendingHunk(pendingHunk));
      pendingHunk = null;
      canonicalLine += lineCount;
      shadowLine += lineCount;
      continue;
    }

    if (!pendingHunk) {
      pendingHunk = {
        id: `hunk-${hunkIndex}`,
        canonicalStartLine: canonicalLine,
        shadowStartLine: shadowLine,
        segments: []
      };
      hunkIndex += 1;
    }

    pendingHunk.segments.push({
      type: change.added ? "added" : "removed",
      text: change.value
    });

    if (change.added) {
      shadowLine += lineCount;
    } else {
      canonicalLine += lineCount;
    }
  }

  hunks.push(...finalizePendingHunk(pendingHunk));
  return hunks;
}
