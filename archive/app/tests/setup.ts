import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, vi } from "vitest";

vi.mock("@monaco-editor/react", () => ({
  Editor: ({
    value,
    onChange
  }: {
    value: string;
    onChange?: (value: string) => void;
  }) =>
    React.createElement("textarea", {
      "aria-label": "Draft markdown",
      value,
      onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
        onChange?.(event.target.value)
    }),
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
    React.createElement(
      "div",
      null,
      React.createElement("textarea", {
        "aria-label": "Draft markdown",
        readOnly,
        value: markdown,
        onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
          onChange?.(event.target.value)
      }),
      React.createElement("div", { "data-testid": "mock-rich-markdown-preview" }, markdown)
    )
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
