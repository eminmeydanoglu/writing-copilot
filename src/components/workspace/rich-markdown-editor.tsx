"use client";

import dynamic from "next/dynamic";
import React from "react";
import type { EditorProps } from "@monaco-editor/react";

const Editor = dynamic(
  async () => (await import("@monaco-editor/react")).Editor,
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[560px] items-center justify-center rounded-[24px] border border-[color:var(--line)] bg-white text-sm text-[color:var(--muted)]">
        Loading editor…
      </div>
    )
  }
);

const editorOptions: EditorProps["options"] = {
  automaticLayout: true,
  fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace",
  fontLigatures: false,
  fontSize: 15,
  lineNumbers: "on",
  lineNumbersMinChars: 3,
  minimap: {
    enabled: false
  },
  padding: {
    top: 24,
    bottom: 24
  },
  renderLineHighlight: "line",
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  wordWrap: "on",
  wrappingIndent: "same"
};

export interface RichMarkdownEditorProps {
  markdown: string;
  readOnly?: boolean;
  showToolbar?: boolean;
  onChange?: (markdown: string) => void;
}

export function RichMarkdownEditor({
  markdown,
  readOnly = false,
  onChange
}: RichMarkdownEditorProps) {
  return (
    <div className="writing-source-editor" aria-label="Draft markdown">
      <Editor
        beforeMount={(monaco) => {
          monaco.editor.defineTheme("writing-copilot-source", {
            base: "vs",
            inherit: true,
            rules: [],
            colors: {
              "editor.background": "#fffdf8",
              "editor.lineHighlightBackground": "#f6f0e6",
              "editorGutter.background": "#fffdf8",
              "editorLineNumber.foreground": "#9b958a",
              "editorLineNumber.activeForeground": "#163534"
            }
          });
        }}
        height="100%"
        language="markdown"
        onChange={(value) => onChange?.(value ?? "")}
        options={{
          ...editorOptions,
          readOnly
        }}
        theme="writing-copilot-source"
        value={markdown}
      />
    </div>
  );
}
