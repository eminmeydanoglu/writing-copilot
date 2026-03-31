import { EditorState } from "@codemirror/state";
import { unifiedMergeView } from "@codemirror/merge";
import {
  getUnifiedMergeDocPair,
  getUnifiedMergeEditorContent,
  readUnifiedMergeEditorContent
} from "../src/diff-mode/merge-view-documents";

describe("merge view document orientation", () => {
  it("keeps shadow as the editable doc and canonical as the original reference", () => {
    const session = {
      canonical: "Selam\nNaber\nBir şey yok\n",
      shadow: "Selam\nNaber\nBir şey yok=\n"
    };

    expect(getUnifiedMergeDocPair(session)).toEqual(session);
    expect(getUnifiedMergeEditorContent(session)).toEqual({
      doc: session.shadow,
      original: session.canonical
    });

    const editorState = EditorState.create({
      doc: session.shadow,
      extensions: [unifiedMergeView({ original: session.canonical })]
    });

    expect(readUnifiedMergeEditorContent(editorState)).toEqual(session);
  });
});
