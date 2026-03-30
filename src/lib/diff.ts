import { Chunk } from "@codemirror/merge";
import { EditorState } from "@codemirror/state";
import type { DiffHunk, DiffHunkKind, DiffSegment } from "./types";

function buildDocument(text: string) {
  return EditorState.create({ doc: text }).doc;
}

function getHunkKind(
  canonicalLineCount: number,
  shadowLineCount: number
): DiffHunkKind {
  if (canonicalLineCount === 0) {
    return "added";
  }

  if (shadowLineCount === 0) {
    return "removed";
  }

  return "modified";
}

function getLineNumberAt(doc: EditorState["doc"], position: number): number {
  return doc.lineAt(Math.min(position, doc.length)).number;
}

function getLineCountForRange(
  doc: EditorState["doc"],
  from: number,
  to: number,
  end: number
): number {
  if (from === to) {
    return 0;
  }

  const startLine = getLineNumberAt(doc, from);
  const endLine = getLineNumberAt(doc, end);
  return endLine - startLine + 1;
}

function buildSegments(
  chunk: Chunk,
  canonical: string,
  shadow: string
): DiffSegment[] {
  const segments: DiffSegment[] = [];

  if (chunk.toA > chunk.fromA) {
    segments.push({
      type: "removed",
      text: canonical.slice(chunk.fromA, chunk.toA)
    });
  }

  if (chunk.toB > chunk.fromB) {
    segments.push({
      type: "added",
      text: shadow.slice(chunk.fromB, chunk.toB)
    });
  }

  return segments;
}

export function diffDocuments(canonical: string, shadow: string): DiffHunk[] {
  const canonicalDoc = buildDocument(canonical);
  const shadowDoc = buildDocument(shadow);
  const chunks = Chunk.build(canonicalDoc, shadowDoc, {
    scanLimit: 500
  });

  return chunks.map((chunk, index) => {
    const canonicalStartLine = getLineNumberAt(canonicalDoc, chunk.fromA);
    const shadowStartLine = getLineNumberAt(shadowDoc, chunk.fromB);
    const canonicalLineCount = getLineCountForRange(
      canonicalDoc,
      chunk.fromA,
      chunk.toA,
      chunk.endA
    );
    const shadowLineCount = getLineCountForRange(
      shadowDoc,
      chunk.fromB,
      chunk.toB,
      chunk.endB
    );

    return {
      id: `hunk-${index}`,
      kind: getHunkKind(canonicalLineCount, shadowLineCount),
      canonicalStartLine,
      canonicalLineCount,
      shadowStartLine,
      shadowLineCount,
      segments: buildSegments(chunk, canonical, shadow)
    };
  });
}
