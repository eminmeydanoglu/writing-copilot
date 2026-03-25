import { diffLines } from "diff";
import type { DiffHunk, DiffSegment, ReviewDecision } from "@/src/lib/workspace/types";

interface ChangeGroup {
  id: string;
  canonicalStartLine: number;
  shadowStartLine: number;
  segments: DiffSegment[];
}

function countLines(value: string): number {
  const matches = value.match(/[^\n]*\n|[^\n]+$/g);
  return matches?.length ?? 0;
}

function finalizeGroup(group: ChangeGroup | null): DiffHunk[] {
  if (!group || group.segments.length === 0) {
    return [];
  }

  const hasAdded = group.segments.some((segment) => segment.type === "added");
  const hasRemoved = group.segments.some(
    (segment) => segment.type === "removed"
  );

  return [
    {
      ...group,
      kind: hasAdded && hasRemoved ? "modified" : hasAdded ? "added" : "removed"
    }
  ];
}

function buildHunks(canonical: string, shadow: string): DiffHunk[] {
  const changes = diffLines(canonical, shadow);
  const hunks: DiffHunk[] = [];
  let canonicalLine = 1;
  let shadowLine = 1;
  let currentGroup: ChangeGroup | null = null;
  let hunkIndex = 0;

  for (const change of changes) {
    const lineCount = countLines(change.value);

    if (!change.added && !change.removed) {
      hunks.push(...finalizeGroup(currentGroup));
      currentGroup = null;
      canonicalLine += lineCount;
      shadowLine += lineCount;
      continue;
    }

    if (!currentGroup) {
      currentGroup = {
        id: `hunk-${hunkIndex}`,
        canonicalStartLine: canonicalLine,
        shadowStartLine: shadowLine,
        segments: []
      };
      hunkIndex += 1;
    }

    currentGroup.segments.push({
      type: change.added ? "added" : "removed",
      value: change.value
    });

    if (change.added) {
      shadowLine += lineCount;
    } else {
      canonicalLine += lineCount;
    }
  }

  hunks.push(...finalizeGroup(currentGroup));
  return hunks;
}

export function diffDocuments(canonical: string, shadow: string): DiffHunk[] {
  return buildHunks(canonical, shadow);
}

export function applyHunkDecisions(
  canonical: string,
  shadow: string,
  hunks: DiffHunk[],
  decisions: Partial<Record<string, ReviewDecision>>
): string {
  return applyHunkDecisionSet(canonical, shadow, hunks, decisions).canonical;
}

export function applyHunkDecisionSet(
  canonical: string,
  shadow: string,
  hunks: DiffHunk[],
  decisions: Partial<Record<string, ReviewDecision>>
): { canonical: string; shadow: string } {
  const changes = diffLines(canonical, shadow);
  const hunkOrder = new Map(hunks.map((hunk) => [hunk.id, hunk]));
  const orderedIds = hunks.map((hunk) => hunk.id);
  let currentIndex = 0;
  let canonicalResult = "";
  let shadowResult = "";
  let pendingCanonical = "";
  let pendingShadow = "";

  const flushPending = () => {
    if (pendingCanonical === "" && pendingShadow === "") {
      return;
    }

    const hunkId = orderedIds[currentIndex];
    const decision = hunkId ? decisions[hunkId] : undefined;

    if (decision === "accept") {
      canonicalResult += pendingShadow;
      shadowResult += pendingShadow;
    } else if (decision === "reject") {
      canonicalResult += pendingCanonical;
      shadowResult += pendingCanonical;
    } else {
      canonicalResult += pendingCanonical;
      shadowResult += pendingShadow;
    }

    pendingCanonical = "";
    pendingShadow = "";
    currentIndex += 1;
  };

  for (const change of changes) {
    if (!change.added && !change.removed) {
      flushPending();
      canonicalResult += change.value;
      shadowResult += change.value;
      continue;
    }

    if (change.added) {
      pendingShadow += change.value;
    } else {
      pendingCanonical += change.value;
    }
  }

  flushPending();

  if (currentIndex !== hunkOrder.size) {
    throw new Error("Hunk application did not consume all diff groups.");
  }

  return { canonical: canonicalResult, shadow: shadowResult };
}
