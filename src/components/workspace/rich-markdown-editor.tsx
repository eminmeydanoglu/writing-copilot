"use client";

import dynamic from "next/dynamic";
import React from "react";
import type { MDXEditorMethods } from "@mdxeditor/editor";

export interface RichMarkdownEditorProps {
  markdown: string;
  readOnly?: boolean;
  showToolbar?: boolean;
  onChange?: (markdown: string) => void;
}

const RichMarkdownEditorImpl = dynamic(
  async () => {
    const editor = await import("@mdxeditor/editor");

    function RichMarkdownEditorImplComponent({
      markdown,
      readOnly = false,
      showToolbar = true,
      onChange
    }: RichMarkdownEditorProps) {
      const editorRef = React.useRef<MDXEditorMethods | null>(null);

      React.useEffect(() => {
        if (!editorRef.current) {
          return;
        }

        if (editorRef.current.getMarkdown() !== markdown) {
          editorRef.current.setMarkdown(markdown);
        }
      }, [markdown]);

      return (
        <editor.MDXEditor
          ref={editorRef}
          className="writing-mdxeditor"
          contentEditableClassName="writing-mdxeditor__content"
          markdown={markdown}
          onChange={(nextMarkdown, initialMarkdownNormalize) => {
            if (!initialMarkdownNormalize) {
              onChange?.(nextMarkdown);
            }
          }}
          plugins={[
            editor.headingsPlugin(),
            editor.listsPlugin(),
            editor.quotePlugin(),
            editor.linkPlugin(),
            editor.linkDialogPlugin(),
            editor.markdownShortcutPlugin(),
            ...(showToolbar
              ? [
                  editor.toolbarPlugin({
                    toolbarClassName: "writing-mdxeditor__toolbar",
                    toolbarContents: () => (
                      <>
                        <editor.UndoRedo />
                        <editor.Separator />
                        <editor.BlockTypeSelect />
                        <editor.Separator />
                        <editor.BoldItalicUnderlineToggles />
                        <editor.Separator />
                        <editor.ListsToggle />
                        <editor.Separator />
                        <editor.CreateLink />
                      </>
                    )
                  })
                ]
              : [])
          ]}
          readOnly={readOnly}
          spellCheck
        />
      );
    }

    return RichMarkdownEditorImplComponent;
  },
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-[color:var(--line)] bg-white text-sm text-[color:var(--muted)]">
        Loading editor…
      </div>
    )
  }
);

export function RichMarkdownEditor(props: RichMarkdownEditorProps) {
  return <RichMarkdownEditorImpl {...props} />;
}
