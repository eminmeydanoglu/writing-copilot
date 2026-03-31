import type { EditorState } from "@codemirror/state";
import { getOriginalDoc } from "@codemirror/merge";

export interface UnifiedMergeDocPair {
  canonical: string;
  shadow: string;
}

export function getUnifiedMergeDocPair(
  session: Pick<UnifiedMergeDocPair, "canonical" | "shadow"> | null
): UnifiedMergeDocPair {
  return {
    canonical: session?.canonical ?? "",
    shadow: session?.shadow ?? ""
  };
}

export function getUnifiedMergeEditorContent(
  session: Pick<UnifiedMergeDocPair, "canonical" | "shadow"> | null
): { doc: string; original: string } {
  const documents = getUnifiedMergeDocPair(session);

  return {
    doc: documents.shadow,
    original: documents.canonical
  };
}

export function readUnifiedMergeEditorContent(state: EditorState): UnifiedMergeDocPair {
  return {
    canonical: getOriginalDoc(state).toString(),
    shadow: state.doc.toString()
  };
}
