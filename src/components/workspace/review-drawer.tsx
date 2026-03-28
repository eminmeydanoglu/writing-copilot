"use client";

import React, { useEffect, useRef, useState } from "react";
import type { DiffEditorProps } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { MonacoDiffView } from "@/src/components/workspace/monaco-diff-view";
import type { DiffHunk } from "@/src/lib/workspace/types";

function summarizeHunk(hunk: DiffHunk): string {
  const summary = hunk.segments
    .map((segment) => segment.value)
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  return summary || "Whitespace change";
}

function getHunkText(hunk: DiffHunk, type: "added" | "removed"): string {
  return hunk.segments
    .filter((segment) => segment.type === type)
    .map((segment) => segment.value)
    .join("")
    .trim();
}

export function ReviewDrawer({
  canonical,
  shadow,
  hunks,
  isOpen,
  selectedHunkId,
  onSelectHunk,
  onAcceptHunk,
  onRejectHunk,
  onAcceptAll,
  onRejectAll,
  isPending = false
}: {
  canonical: string;
  shadow: string;
  hunks: DiffHunk[];
  isOpen: boolean;
  selectedHunkId?: string;
  onSelectHunk?: (hunkId: string) => void;
  onAcceptHunk?: (hunkId: string) => void;
  onRejectHunk?: (hunkId: string) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  isPending?: boolean;
}) {
  const [internalSelectedHunkId, setInternalSelectedHunkId] = useState<string | null>(
    selectedHunkId ?? hunks[0]?.id ?? null
  );
  const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null);

  useEffect(() => {
    setInternalSelectedHunkId(selectedHunkId ?? hunks[0]?.id ?? null);
  }, [hunks, selectedHunkId]);

  const selectedHunk =
    hunks.find((hunk) => hunk.id === internalSelectedHunkId) ?? hunks[0] ?? null;
  const selectedIndex = selectedHunk
    ? hunks.findIndex((hunk) => hunk.id === selectedHunk.id)
    : -1;

  const handleMount: NonNullable<DiffEditorProps["onMount"]> = (
    editorInstance
  ) => {
    editorRef.current = editorInstance;
  };

  function focusEditorOnHunk(hunk: DiffHunk) {
    const line = Math.max(hunk.shadowStartLine, 1);
    editorRef.current?.getModifiedEditor().revealLineInCenter(line);
    editorRef.current?.getModifiedEditor().setPosition({
      lineNumber: line,
      column: 1
    });
  }

  function revealHunk(hunk: DiffHunk) {
    setInternalSelectedHunkId(hunk.id);
    onSelectHunk?.(hunk.id);
    focusEditorOnHunk(hunk);
  }

  function moveSelection(offset: -1 | 1) {
    if (selectedIndex < 0) {
      return;
    }

    const nextHunk = hunks[selectedIndex + offset];

    if (nextHunk) {
      revealHunk(nextHunk);
    }
  }

  useEffect(() => {
    if (selectedHunk) {
      focusEditorOnHunk(selectedHunk);
    }
  }, [selectedHunk]);

  if (!isOpen) {
    return null;
  }

  if (hunks.length === 0) {
    return (
      <section className="flex min-h-[560px] min-w-0 flex-1 flex-col">
        <div className="border-b border-[color:var(--line)] px-6 py-5">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
            Pending review
          </p>
          <h2 className="mt-2 text-2xl text-[color:var(--accent)] [font-family:var(--font-serif)]">
            Review complete
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
            No pending hunks remain. The shadow draft is now aligned with the
            canonical draft.
          </p>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="max-w-xl rounded-[24px] border border-[color:var(--line)] bg-white px-6 py-8 text-center shadow-[0_20px_50px_rgba(26,31,29,0.08)]">
            <p className="text-sm uppercase tracking-[0.22em] text-[color:var(--muted)]">
              All synced
            </p>
            <p className="mt-4 text-lg leading-8 text-[color:var(--accent)] [font-family:var(--font-serif)]">
              The next recommendation round will appear in this same document
              window.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-[560px] min-w-0 flex-1 flex-col bg-[color:var(--paper)]">
      <div className="flex flex-col gap-4 border-b border-[color:var(--line)] px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
              Pending review
            </p>
            <h2 className="mt-2 text-2xl text-[color:var(--accent)] [font-family:var(--font-serif)]">
              Inline review
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
              The document surface switches into inline diff mode so you can
              inspect only the changed regions and decide chunk by chunk.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={isPending || selectedIndex <= 0}
              onClick={() => moveSelection(-1)}
              type="button"
            >
              Previous
            </button>
            <button
              className="rounded-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={
                isPending ||
                selectedIndex < 0 ||
                selectedIndex >= hunks.length - 1
              }
              onClick={() => moveSelection(1)}
              type="button"
            >
              Next
            </button>
            <button
              className="rounded-full border border-[color:rgba(53,104,89,0.24)] bg-[color:rgba(53,104,89,0.12)] px-3 py-2 text-sm font-semibold text-[color:var(--accept)] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={isPending || hunks.length === 0 || !onAcceptAll}
              onClick={onAcceptAll}
              type="button"
            >
              {isPending ? "Applying…" : "Accept all"}
            </button>
            <button
              className="rounded-full border border-[color:rgba(140,59,47,0.22)] bg-[color:rgba(140,59,47,0.08)] px-3 py-2 text-sm font-semibold text-[color:var(--reject)] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={isPending || hunks.length === 0 || !onRejectAll}
              onClick={onRejectAll}
              type="button"
            >
              {isPending ? "Applying…" : "Reject all"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {hunks.map((hunk, index) => {
            const isSelected = hunk.id === selectedHunk?.id;

            return (
              <button
                key={hunk.id}
                className={`rounded-full px-3 py-2 text-sm transition ${
                  isSelected
                    ? "border border-[color:var(--accent)] bg-[color:rgba(22,53,52,0.09)] font-semibold text-[color:var(--accent)]"
                    : "border border-[color:var(--line)] bg-white text-[color:var(--muted)]"
                }`}
                onClick={() => revealHunk(hunk)}
                type="button"
              >
                Change {index + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-5">
        {selectedHunk ? (
          <section className="rounded-[24px] border border-[color:var(--line)] bg-white px-5 py-4 shadow-[0_14px_30px_rgba(26,31,29,0.05)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--muted)]">
                  Selected change {selectedIndex + 1} of {hunks.length}
                </p>
                <p className="mt-2 text-base leading-7 text-[color:var(--text)]">
                  {summarizeHunk(selectedHunk)}
                </p>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Canonical line {selectedHunk.canonicalStartLine}, suggestion
                  line {selectedHunk.shadowStartLine}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-full bg-[color:var(--accept)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={isPending || !onAcceptHunk}
                  onClick={() => onAcceptHunk?.(selectedHunk.id)}
                  type="button"
                >
                  {isPending ? "Applying…" : "Accept change"}
                </button>
                <button
                  className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--reject)] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={isPending || !onRejectHunk}
                  onClick={() => onRejectHunk?.(selectedHunk.id)}
                  type="button"
                >
                  {isPending ? "Applying…" : "Reject change"}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-[18px] border border-[color:rgba(138,65,52,0.12)] bg-[color:rgba(138,65,52,0.05)] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--reject)]">
                  Current
                </p>
                <pre className="mt-2 whitespace-pre-wrap font-mono text-sm leading-6 text-[color:var(--text)]">
                  {getHunkText(selectedHunk, "removed") ||
                    "(No current text in this chunk.)"}
                </pre>
              </div>
              <div className="rounded-[18px] border border-[color:rgba(47,106,85,0.14)] bg-[color:rgba(47,106,85,0.06)] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accept)]">
                  Suggested
                </p>
                <pre className="mt-2 whitespace-pre-wrap font-mono text-sm leading-6 text-[color:var(--text)]">
                  {getHunkText(selectedHunk, "added") ||
                    "(This suggestion removes text without adding new lines.)"}
                </pre>
              </div>
            </div>
          </section>
        ) : null}

        <div className="min-h-0 flex-1">
          <MonacoDiffView
            modified={shadow}
            onMount={handleMount}
            original={canonical}
          />
        </div>
      </div>
    </section>
  );
}
