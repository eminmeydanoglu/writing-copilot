import type { EditorView } from "@codemirror/view";
import type { DiffModeSnapshot } from "../lib/diff-mode";

type SelectHunkCallback = (filePath: string, lineNumber: number) => void;

class DiffModeRuntime {
  private snapshot: DiffModeSnapshot | null = null;
  private readonly editorViews = new Set<EditorView>();
  private selectHunkCallback: SelectHunkCallback | null = null;

  getSnapshot(): DiffModeSnapshot | null {
    return this.snapshot;
  }

  setSnapshot(snapshot: DiffModeSnapshot | null): void {
    this.snapshot = snapshot;
    this.requestEditorRefresh();
  }

  setSelectHunkCallback(callback: SelectHunkCallback | null): void {
    this.selectHunkCallback = callback;
  }

  selectHunkByLine(filePath: string, lineNumber: number): void {
    this.selectHunkCallback?.(filePath, lineNumber);
  }

  registerEditorView(view: EditorView): () => void {
    this.editorViews.add(view);

    return () => {
      this.editorViews.delete(view);
    };
  }

  private requestEditorRefresh(): void {
    for (const view of this.editorViews) {
      view.dispatch({});
    }
  }
}

export const diffModeRuntime = new DiffModeRuntime();
