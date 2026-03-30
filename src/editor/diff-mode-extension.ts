import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate
} from "@codemirror/view";
import { editorInfoField } from "obsidian";
import {
  findHunkIdAtLine,
  getHunkLineRange,
  type DiffModeRole
} from "../lib/diff-mode";
import { diffModeRuntime } from "../diff-mode/runtime";

function getRoleForFilePath(filePath: string): DiffModeRole | null {
  const snapshot = diffModeRuntime.getSnapshot();

  if (!snapshot) {
    return null;
  }

  if (filePath === snapshot.canonicalPath) {
    return "canonical";
  }

  if (filePath === snapshot.shadowPath) {
    return "shadow";
  }

  return null;
}

function buildDecorations(view: EditorView): DecorationSet {
  const snapshot = diffModeRuntime.getSnapshot();

  if (!snapshot) {
    return Decoration.none;
  }

  const info = view.state.field(editorInfoField, false);
  const filePath = info?.file?.path;

  if (!filePath) {
    return Decoration.none;
  }

  const role = getRoleForFilePath(filePath);

  if (!role) {
    return Decoration.none;
  }

  const builder = new RangeSetBuilder<Decoration>();

  for (const hunk of snapshot.hunks) {
    const range = getHunkLineRange(hunk, role);

    if (!range) {
      continue;
    }

    for (let lineNumber = range.startLine; lineNumber <= range.endLine; lineNumber += 1) {
      const line = view.state.doc.line(lineNumber);
      const classNames = [
        "writing-copilot-diff-line",
        role === "canonical" ? "is-canonical-change" : "is-shadow-change"
      ];

      if (hunk.kind === "added") {
        classNames.push("is-added");
      } else if (hunk.kind === "removed") {
        classNames.push("is-removed");
      } else {
        classNames.push("is-modified");
      }

      if (snapshot.selectedHunkId === hunk.id) {
        classNames.push("is-selected");
      }

      builder.add(
        line.from,
        line.from,
        Decoration.line({
          class: classNames.join(" ")
        })
      );
    }
  }

  return builder.finish();
}

export const diffModeEditorExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private readonly unregisterView: () => void;

    constructor(private readonly view: EditorView) {
      this.unregisterView = diffModeRuntime.registerEditorView(view);
      this.decorations = buildDecorations(view);
      this.maybeSyncSelection();
    }

    update(update: ViewUpdate): void {
      this.decorations = buildDecorations(update.view);

      if (update.selectionSet || update.docChanged || update.viewportChanged) {
        this.maybeSyncSelection();
      }
    }

    destroy(): void {
      this.unregisterView();
    }

    private maybeSyncSelection(): void {
      const snapshot = diffModeRuntime.getSnapshot();

      if (!snapshot || snapshot.isApplying) {
        return;
      }

      const info = this.view.state.field(editorInfoField, false);
      const filePath = info?.file?.path;
      const role = filePath ? getRoleForFilePath(filePath) : null;

      if (!filePath || !role) {
        return;
      }

      const headLine = this.view.state.doc.lineAt(this.view.state.selection.main.head).number;
      const hunkId = findHunkIdAtLine(snapshot.hunks, role, headLine);

      if (!hunkId || hunkId === snapshot.selectedHunkId) {
        return;
      }

      diffModeRuntime.selectHunkByLine(filePath, headLine);
    }
  },
  {
    decorations: (value) => value.decorations
  }
);
