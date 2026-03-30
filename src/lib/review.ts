import { diffLines } from "diff";
import { diffDocuments } from "./diff";
import type { DiffHunk, ReviewDecisionSet } from "./types";

export interface ReviewResult {
  canonical: string;
  shadow: string;
  hunks: DiffHunk[];
  isComplete: boolean;
}

function validateDecisionSet(
  hunks: DiffHunk[],
  decisions: ReviewDecisionSet
): void {
  const knownIds = new Set(hunks.map((hunk) => hunk.id));

  for (const hunkId of Object.keys(decisions)) {
    if (!knownIds.has(hunkId)) {
      throw new Error(`Unknown review hunk id "${hunkId}".`);
    }
  }
}

function areHunksEquivalent(left: DiffHunk[], right: DiffHunk[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((leftHunk, index) => {
    const rightHunk = right[index];

    if (!rightHunk) {
      return false;
    }

    if (
      leftHunk.id !== rightHunk.id ||
      leftHunk.kind !== rightHunk.kind ||
      leftHunk.canonicalStartLine !== rightHunk.canonicalStartLine ||
      leftHunk.canonicalLineCount !== rightHunk.canonicalLineCount ||
      leftHunk.shadowStartLine !== rightHunk.shadowStartLine ||
      leftHunk.shadowLineCount !== rightHunk.shadowLineCount ||
      leftHunk.segments.length !== rightHunk.segments.length
    ) {
      return false;
    }

    return leftHunk.segments.every((leftSegment, segmentIndex) => {
      const rightSegment = rightHunk.segments[segmentIndex];

      return (
        !!rightSegment &&
        leftSegment.type === rightSegment.type &&
        leftSegment.text === rightSegment.text
      );
    });
  });
}

function validateHunkSnapshot(
  canonical: string,
  shadow: string,
  hunks: DiffHunk[]
): void {
  const currentHunks = diffDocuments(canonical, shadow);

  if (!areHunksEquivalent(hunks, currentHunks)) {
    throw new Error(
      "Review hunk snapshot is stale. Recompute hunks before applying decisions."
    );
  }
}

function applyDecisionSetToDocuments(
  canonical: string,
  shadow: string,
  hunks: DiffHunk[],
  decisions: ReviewDecisionSet
): { canonical: string; shadow: string } {
  validateHunkSnapshot(canonical, shadow, hunks);
  validateDecisionSet(hunks, decisions);

  if (hunks.length === 0 || Object.keys(decisions).length === 0) {
    return {
      canonical,
      shadow
    };
  }

  const changes = diffLines(canonical, shadow);
  const orderedIds = hunks.map((hunk) => hunk.id);
  let canonicalResult = "";
  let shadowResult = "";
  let pendingCanonical = "";
  let pendingShadow = "";
  let hunkCursor = 0;

  const flushPending = (): void => {
    if (pendingCanonical === "" && pendingShadow === "") {
      return;
    }

    const hunkId = orderedIds[hunkCursor];
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
    hunkCursor += 1;
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
      continue;
    }

    pendingCanonical += change.value;
  }

  flushPending();

  if (hunkCursor !== hunks.length) {
    throw new Error("Review application did not consume all pending hunks.");
  }

  return {
    canonical: canonicalResult,
    shadow: shadowResult
  };
}

export function applyReviewDecisionSet(
  canonical: string,
  shadow: string,
  decisions: ReviewDecisionSet,
  hunks: DiffHunk[] = diffDocuments(canonical, shadow)
): ReviewResult {
  const reviewed = applyDecisionSetToDocuments(canonical, shadow, hunks, decisions);
  const pendingHunks = diffDocuments(reviewed.canonical, reviewed.shadow);

  return {
    canonical: reviewed.canonical,
    shadow: reviewed.shadow,
    hunks: pendingHunks,
    isComplete: pendingHunks.length === 0
  };
}

export function acceptReviewHunk(
  canonical: string,
  shadow: string,
  hunkId: string,
  hunks: DiffHunk[] = diffDocuments(canonical, shadow)
): ReviewResult {
  return applyReviewDecisionSet(canonical, shadow, { [hunkId]: "accept" }, hunks);
}

export function rejectReviewHunk(
  canonical: string,
  shadow: string,
  hunkId: string,
  hunks: DiffHunk[] = diffDocuments(canonical, shadow)
): ReviewResult {
  return applyReviewDecisionSet(canonical, shadow, { [hunkId]: "reject" }, hunks);
}

export function acceptAllReviewHunks(
  canonical: string,
  shadow: string,
  hunks: DiffHunk[] = diffDocuments(canonical, shadow)
): ReviewResult {
  return applyReviewDecisionSet(
    canonical,
    shadow,
    Object.fromEntries(hunks.map((hunk) => [hunk.id, "accept"])),
    hunks
  );
}

export function rejectAllReviewHunks(
  canonical: string,
  shadow: string,
  hunks: DiffHunk[] = diffDocuments(canonical, shadow)
): ReviewResult {
  return applyReviewDecisionSet(
    canonical,
    shadow,
    Object.fromEntries(hunks.map((hunk) => [hunk.id, "reject"])),
    hunks
  );
}
