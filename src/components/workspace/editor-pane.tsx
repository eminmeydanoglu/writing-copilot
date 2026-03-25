"use client";

import React from "react";
import { RichMarkdownEditor } from "@/src/components/workspace/rich-markdown-editor";

export function EditorPane({
  draft,
  pendingChanges,
  isDirty,
  isSaving = false,
  onChange,
  onSave
}: {
  draft: string;
  pendingChanges: number;
  isDirty: boolean;
  isSaving?: boolean;
  onChange?: (markdown: string) => void;
  onSave?: () => void;
}) {
  const isLocked = pendingChanges > 0;

  return (
    <section className="flex min-h-[560px] min-w-0 flex-1 flex-col">
      <div className="flex flex-col gap-4 border-b border-[color:var(--line)] px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
            Canonical draft
          </p>
          <h2 className="mt-2 text-2xl text-[color:var(--accent)] [font-family:var(--font-serif)]">
            Write
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
            Edit the canonical markdown directly. Markdown shortcuts and toolbar
            actions are enabled.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-sm text-[color:var(--muted)]">
            {isLocked
              ? `${pendingChanges} changes waiting in review`
              : isDirty
                ? "Unsaved canonical changes"
                : "Canonical draft is in sync"}
          </div>
          <button
            className="rounded-full border border-[color:var(--line)] bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            disabled={isSaving || isLocked || !isDirty || !onSave}
            onClick={onSave}
            type="button"
          >
            {isSaving ? "Saving…" : "Save draft"}
          </button>
        </div>
      </div>

      {isLocked ? (
        <div className="border-b border-[color:var(--line)] bg-[color:rgba(24,58,55,0.05)] px-6 py-4 text-sm text-[color:var(--muted)]">
          Resolve all pending review changes before editing the canonical draft.
        </div>
      ) : null}

      <div className="flex-1 overflow-auto px-6 py-8">
        <RichMarkdownEditor
          markdown={draft}
          onChange={onChange}
          readOnly={isSaving || isLocked}
          showToolbar={!isLocked}
        />
      </div>
    </section>
  );
}
