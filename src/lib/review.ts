import { Chunk } from "@codemirror/merge";
import { EditorState } from "@codemirror/state";
import { diffDocuments } from "./diff";
import type { DiffHunk, ReviewDecisionSet } from "./types";

export interface ReviewResult {
  canonical: string;
  shadow: string;
  hunks: DiffHunk[];
  isComplete: boolean;
}

function buildDocument(text: string) {
  return EditorState.create({ doc: text }).doc;
}

function getLineBreak(canonical: string, shadow: string): string {
  return canonical.includes("\r\n") || shadow.includes("\r\n") ? "\r\n" : "\n";
}

function getChunkText(
  doc: ReturnType<typeof buildDocument>,
  from: number,
  to: number,
  otherTo: number,
  otherLength: number,
  lineBreak: string
): string {
  let insert = doc.sliceString(from, Math.max(from, to - 1));

  if (from !== to && otherTo <= otherLength) {
    insert += lineBreak;
  }

  return insert;
}

function replaceRange(text: string, from: number, to: number, insert: string): string {
  return text.slice(0, from) + insert + text.slice(Math.min(text.length, to));
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

  const canonicalDoc = buildDocument(canonical);
  const shadowDoc = buildDocument(shadow);
  const chunks = Chunk.build(canonicalDoc, shadowDoc, {
    scanLimit: 500
  });
  const lineBreak = getLineBreak(canonical, shadow);
  let nextCanonical = canonical;
  let nextShadow = shadow;

  for (let index = hunks.length - 1; index >= 0; index -= 1) {
    const hunk = hunks[index];
    const decision = hunk ? decisions[hunk.id] : undefined;

    if (!decision) {
      continue;
    }

    const chunk = chunks[index];

    if (!chunk) {
      throw new Error("Review hunk snapshot is stale. Recompute hunks before applying decisions.");
    }

    if (decision === "accept") {
      const insert = getChunkText(
        shadowDoc,
        chunk.fromB,
        chunk.toB,
        chunk.toA,
        canonicalDoc.length,
        lineBreak
      );

      nextCanonical = replaceRange(nextCanonical, chunk.fromA, chunk.toA, insert);
      continue;
    }

    const insert = getChunkText(
      canonicalDoc,
      chunk.fromA,
      chunk.toA,
      chunk.toB,
      shadowDoc.length,
      lineBreak
    );

    nextShadow = replaceRange(nextShadow, chunk.fromB, chunk.toB, insert);
  }

  return {
    canonical: nextCanonical,
    shadow: nextShadow
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
