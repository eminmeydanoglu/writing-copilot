"use client";

import dynamic from "next/dynamic";
import React from "react";
import type { DiffEditorProps } from "@monaco-editor/react";

const DiffEditor = dynamic(
  async () => (await import("@monaco-editor/react")).DiffEditor,
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-[24px] border border-[color:var(--line)] bg-[color:var(--panel-strong)] text-sm text-[color:var(--muted)]">
        Loading review editor…
      </div>
    )
  }
);

const editorOptions: DiffEditorProps["options"] = {
  automaticLayout: true,
  diffAlgorithm: "advanced",
  fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace",
  fontLigatures: false,
  fontSize: 15,
  glyphMargin: true,
  lineDecorationsWidth: 10,
  lineNumbers: "on",
  lineNumbersMinChars: 3,
  minimap: {
    enabled: false
  },
  overviewRulerBorder: false,
  padding: {
    top: 22,
    bottom: 28
  },
  readOnly: true,
  renderIndicators: true,
  renderOverviewRuler: false,
  renderSideBySide: false,
  scrollBeyondLastLine: false,
  scrollbar: {
    alwaysConsumeMouseWheel: false,
    verticalScrollbarSize: 12,
    horizontalScrollbarSize: 12
  },
  smoothScrolling: true,
  stickyScroll: {
    enabled: false
  },
  wordWrap: "on",
  wrappingIndent: "same"
};

export function MonacoDiffView(props: DiffEditorProps) {
  return (
    <div className="review-surface h-full min-h-[560px] overflow-hidden rounded-[24px] border border-[color:rgba(255,255,255,0.08)] bg-[#111312] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <DiffEditor
        {...props}
        beforeMount={(monaco) => {
          monaco.editor.defineTheme("writing-copilot-review", {
            base: "vs-dark",
            inherit: true,
            rules: [],
            colors: {
              "editor.background": "#111312",
              "editorGutter.background": "#111312",
              "diffEditor.insertedTextBackground": "#21443755",
              "diffEditor.insertedLineBackground": "#2144372d",
              "diffEditor.removedTextBackground": "#6a322955",
              "diffEditor.removedLineBackground": "#6a32292d",
              "diffEditor.diagonalFill": "#111312"
            }
          });
        }}
        height="100%"
        keepCurrentModifiedModel
        keepCurrentOriginalModel
        language="markdown"
        modifiedModelPath="inmemory://writing-copilot/shadow.md"
        options={{
          ...editorOptions,
          hideUnchangedRegions: {
            enabled: false
          },
          ...props.options
        }}
        originalModelPath="inmemory://writing-copilot/canonical.md"
        theme="writing-copilot-review"
      />
    </div>
  );
}
