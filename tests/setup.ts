import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, vi } from "vitest";

vi.mock("@monaco-editor/react", () => ({
  DiffEditor: ({
    original,
    modified
  }: {
    original: string;
    modified: string;
  }) =>
    React.createElement(
      "div",
      { "data-testid": "monaco-diff-editor" },
      `${original}:::${modified}`
    )
}));

vi.mock("@/src/components/workspace/rich-markdown-editor", () => ({
  RichMarkdownEditor: ({
    markdown,
    readOnly,
    onChange
  }: {
    markdown: string;
    readOnly?: boolean;
    onChange?: (value: string) => void;
  }) =>
    React.createElement("textarea", {
      readOnly,
      value: markdown,
      onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
        onChange?.(event.target.value)
    })
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
