"use client";

import dynamic from "next/dynamic";
import React from "react";
import type { DiffEditorProps } from "@monaco-editor/react";

const DiffEditor = dynamic(
  async () => (await import("@monaco-editor/react")).DiffEditor,
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-[22px] border border-[color:var(--line)] bg-[color:var(--paper)] text-sm text-[color:var(--muted)]">
        Loading full diff view…
      </div>
    )
  }
);

const editorOptions: DiffEditorProps["options"] = {
  automaticLayout: true,
  fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace",
  fontLigatures: false,
  fontSize: 13,
  lineDecorationsWidth: 12,
  minimap: {
    enabled: false
  },
  readOnly: true,
  renderSideBySide: true,
  scrollBeyondLastLine: false,
  wordWrap: "on"
};

export function MonacoDiffView(props: DiffEditorProps) {
  return (
    <div className="h-full min-h-[360px] overflow-hidden rounded-[22px] border border-[color:var(--line)] bg-[#f7f5f0]">
      <DiffEditor
        {...props}
        height="100%"
        keepCurrentModifiedModel
        keepCurrentOriginalModel
        language="markdown"
        modifiedModelPath="inmemory://writing-copilot/shadow.md"
        options={{
          ...editorOptions,
          ...props.options
        }}
        originalModelPath="inmemory://writing-copilot/canonical.md"
        theme="vs"
      />
    </div>
  );
}
