"use client";

import React, { useEffect, useRef, useState } from "react";
import type { DiffEditorProps } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { MonacoDiffView } from "@/src/components/workspace/monaco-diff-view";
import { RenderedMarkdownDocument } from "@/src/components/workspace/rendered-markdown-document";
import { RichMarkdownEditor } from "@/src/components/workspace/rich-markdown-editor";
import type { DiffHunk } from "@/src/lib/workspace/types";

function summarizeHunk(hunk: DiffHunk): string {
  const firstSegment = hunk.segments[0]?.value ?? "";
  return firstSegment.replace(/\s+/g, " ").trim() || "Whitespace change";
}

function getHunkText(hunk: DiffHunk, type: "added" | "removed"): string {
  return hunk.segments
    .filter((segment) => segment.type === type)
    .map((segment) => segment.value)
    .join("")
    .trim();
}

export function EditorPane({
  canonical,
  draft,
  shadow,
  hunks,
  isReviewOpen,
  saveState,
  isSaving = false,
  onChange,
  onToggleReview,
  onAcceptHunk,
  onRejectHunk,
  onAcceptAll,
  onRejectAll
}: {
  canonical: string;
  draft: string;
  shadow: string;
  hunks: DiffHunk[];
  isReviewOpen: boolean;
  saveState: "idle" | "dirty" | "saving" | "saved" | "error";
  isSaving?: boolean;
  onChange?: (markdown: string) => void;
  onToggleReview?: () => void;
  onAcceptHunk?: (hunkId: string) => void;
  onRejectHunk?: (hunkId: string) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
}) {
  const [surfaceMode, setSurfaceMode] = useState<"read" | "edit">("read");
  const [selectedHunkId, setSelectedHunkId] = useState<string | null>(
    hunks[0]?.id ?? null
  );
  const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const pendingChanges = hunks.length;
  const isReadMode = !isReviewOpen && surfaceMode === "read";
  const isEditMode = !isReviewOpen && surfaceMode === "edit";
  const selectedHunk =
    hunks.find((hunk) => hunk.id === selectedHunkId) ?? hunks[0] ?? null;
  const selectedIndex = selectedHunk
    ? hunks.findIndex((hunk) => hunk.id === selectedHunk.id)
    : -1;
  const saveLabel =
    saveState === "saving"
      ? "Autosaving…"
      : saveState === "dirty"
        ? "Autosave pending"
        : saveState === "saved"
          ? "Autosaved"
          : saveState === "error"
            ? "Autosave failed"
            : "Live sync";

  useEffect(() => {
    setSelectedHunkId((current) => {
      if (current && hunks.some((hunk) => hunk.id === current)) {
        return current;
      }

      return hunks[0]?.id ?? null;
    });
  }, [hunks]);

  const handleDiffMount: NonNullable<DiffEditorProps["onMount"]> = (
    editorInstance
  ) => {
    editorRef.current = editorInstance;
  };

  function focusSelectedHunk(hunk: DiffHunk | null) {
    if (!hunk) {
      return;
    }

    const line = Math.max(hunk.shadowStartLine, 1);
    editorRef.current?.getModifiedEditor().revealLineInCenter(line);
    editorRef.current?.getModifiedEditor().setPosition({
      lineNumber: line,
      column: 1
    });
  }

  useEffect(() => {
    if (isReviewOpen) {
      focusSelectedHunk(selectedHunk);
    }
  }, [isReviewOpen, selectedHunk]);

  function moveSelection(offset: -1 | 1) {
    if (selectedIndex < 0) {
      return;
    }

    const nextHunk = hunks[selectedIndex + offset];

    if (nextHunk) {
      setSelectedHunkId(nextHunk.id);
      focusSelectedHunk(nextHunk);
    }
  }

  return (
    <section className="flex min-h-[560px] min-w-0 flex-1 flex-col">
      <div className="flex flex-col gap-4 border-b border-[color:var(--line)] px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
              Document
            </p>
            <h2 className="mt-2 text-2xl text-[color:var(--accent)] [font-family:var(--font-serif)]">
              {isReviewOpen
                ? "Inline review"
                : isEditMode
                  ? "Edit draft"
                  : "Read draft"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
              {isReviewOpen
                ? "Review the shadow suggestions without leaving the document surface. Each change stays anchored in context."
                : isEditMode
                  ? "Edit canonical markdown directly. Autosave writes back to `draft.md` while you stay in the same pane."
                  : "This stage mirrors `draft.md` as rendered markdown. Switch to source only when you want to edit the raw document."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isReviewOpen ? (
              <div
                aria-label="Document mode"
                className="inline-flex rounded-full border border-[color:var(--line)] bg-white p-1"
                role="tablist"
              >
                <button
                  aria-pressed={isReadMode}
                  className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                    isReadMode
                      ? "bg-[color:var(--accent)] text-white"
                      : "text-[color:var(--muted)]"
                  }`}
                  onClick={() => setSurfaceMode("read")}
                  type="button"
                >
                  Read
                </button>
                <button
                  aria-pressed={isEditMode}
                  className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                    isEditMode
                      ? "bg-[color:var(--accent)] text-white"
                      : "text-[color:var(--muted)]"
                  }`}
                  onClick={() => setSurfaceMode("edit")}
                  type="button"
                >
                  Edit
                </button>
              </div>
            ) : null}

            <div className="rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-sm text-[color:var(--muted)]">
              {isReviewOpen
                ? pendingChanges > 0
                  ? `${pendingChanges} pending ${pendingChanges === 1 ? "change" : "changes"}`
                  : "Review complete"
                : saveLabel}
            </div>

            {!isReviewOpen && pendingChanges > 0 && onToggleReview ? (
              <button
                className="rounded-full border border-[color:rgba(22,53,52,0.16)] bg-[color:rgba(22,53,52,0.10)] px-3 py-2 text-sm font-semibold text-[color:var(--accent)] shadow-[0_0_0_1px_rgba(22,53,52,0.03)] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={isSaving}
                onClick={onToggleReview}
                type="button"
              >
                Review {pendingChanges}
              </button>
            ) : null}

            {isReviewOpen && onToggleReview ? (
              <button
                className="rounded-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={isSaving}
                onClick={onToggleReview}
                type="button"
              >
                Back to draft
              </button>
            ) : null}
          </div>
        </div>

        {isReviewOpen ? (
          <div className="flex flex-col gap-3 rounded-[22px] border border-[color:var(--line)] bg-[color:rgba(255,255,255,0.72)] px-4 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  {selectedHunk
                    ? `Change ${selectedIndex + 1} of ${pendingChanges}`
                    : "No selected change"}
                </p>
                <p className="mt-1 truncate text-sm text-[color:var(--text)]">
                  {selectedHunk
                    ? summarizeHunk(selectedHunk)
                    : "No pending review chunks remain."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={isSaving || selectedIndex <= 0}
                  onClick={() => moveSelection(-1)}
                  type="button"
                >
                  Previous
                </button>
                <button
                  className="rounded-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={
                    isSaving ||
                    selectedIndex < 0 ||
                    selectedIndex >= hunks.length - 1
                  }
                  onClick={() => moveSelection(1)}
                  type="button"
                >
                  Next
                </button>
                <button
                  className="rounded-full bg-[color:var(--accept)] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={isSaving || !selectedHunk || !onAcceptHunk}
                  onClick={() => selectedHunk && onAcceptHunk?.(selectedHunk.id)}
                  type="button"
                >
                  {isSaving ? "Applying…" : "Accept change"}
                </button>
                <button
                  className="rounded-full border border-[color:rgba(140,59,47,0.22)] bg-[color:rgba(140,59,47,0.08)] px-3 py-2 text-sm font-semibold text-[color:var(--reject)] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={isSaving || !selectedHunk || !onRejectHunk}
                  onClick={() => selectedHunk && onRejectHunk?.(selectedHunk.id)}
                  type="button"
                >
                  {isSaving ? "Applying…" : "Reject change"}
                </button>
                <button
                  className="rounded-full border border-[color:rgba(53,104,89,0.24)] bg-[color:rgba(53,104,89,0.12)] px-3 py-2 text-sm font-semibold text-[color:var(--accept)] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={isSaving || pendingChanges === 0 || !onAcceptAll}
                  onClick={onAcceptAll}
                  type="button"
                >
                  {isSaving ? "Applying…" : "Accept all"}
                </button>
                <button
                  className="rounded-full border border-[color:rgba(140,59,47,0.22)] bg-[color:rgba(140,59,47,0.08)] px-3 py-2 text-sm font-semibold text-[color:var(--reject)] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={isSaving || pendingChanges === 0 || !onRejectAll}
                  onClick={onRejectAll}
                  type="button"
                >
                  {isSaving ? "Applying…" : "Reject all"}
                </button>
              </div>
            </div>

            {pendingChanges > 1 ? (
              <div className="flex flex-wrap gap-2">
                {hunks.map((hunk, index) => {
                  const isSelected = hunk.id === selectedHunk?.id;

                  return (
                    <button
                      key={hunk.id}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        isSelected
                          ? "border-[color:var(--accent)] bg-[color:rgba(22,53,52,0.10)] text-[color:var(--accent)]"
                          : "border-[color:var(--line)] bg-white text-[color:var(--muted)]"
                      }`}
                      onClick={() => {
                        setSelectedHunkId(hunk.id);
                        focusSelectedHunk(hunk);
                      }}
                      type="button"
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {selectedHunk ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-[18px] border border-[color:rgba(138,65,52,0.12)] bg-[color:rgba(138,65,52,0.05)] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--reject)]">
                    Current
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap font-mono text-sm leading-6 text-[color:var(--text)]">
                    {getHunkText(selectedHunk, "removed") ||
                      "(No current text in this chunk.)"}
                  </pre>
                </div>
                <div className="rounded-[18px] border border-[color:rgba(47,106,85,0.14)] bg-[color:rgba(47,106,85,0.06)] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accept)]">
                    Suggested
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap font-mono text-sm leading-6 text-[color:var(--text)]">
                    {getHunkText(selectedHunk, "added") ||
                      "(This suggestion removes text without adding new lines.)"}
                  </pre>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-6 py-6">
        {isReviewOpen ? (
          <MonacoDiffView
            modified={shadow}
            onMount={handleDiffMount}
            options={{
              lineNumbers: "on"
            }}
            original={canonical}
          />
        ) : isReadMode ? (
          <RenderedMarkdownDocument markdown={draft} />
        ) : (
          <RichMarkdownEditor
            markdown={draft}
            onChange={onChange}
            readOnly={isSaving}
            showToolbar
          />
        )}
      </div>
    </section>
  );
}
