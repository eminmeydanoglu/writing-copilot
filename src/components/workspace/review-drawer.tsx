"use client";

import React, { useEffect, useRef, useState } from "react";
import type { DiffEditorProps } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { MonacoDiffView } from "@/src/components/workspace/monaco-diff-view";
import type { DiffHunk } from "@/src/lib/workspace/types";

function summarizeHunk(hunk: DiffHunk): string {
  const firstSegment = hunk.segments[0]?.value ?? "";
  return firstSegment.replace(/\s+/g, " ").trim() || "Whitespace change";
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
    hunks.find((hunk) => hunk.id === internalSelectedHunkId) ??
    hunks[0] ??
    null;
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
            No pending hunks remain. Return to the editor when you are ready to
            continue writing.
          </p>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="max-w-xl rounded-[24px] border border-[color:var(--line)] bg-white px-6 py-8 text-center shadow-[0_20px_50px_rgba(26,31,29,0.08)]">
            <p className="text-sm uppercase tracking-[0.22em] text-[color:var(--muted)]">
              All synced
            </p>
            <p className="mt-4 text-lg leading-8 text-[color:var(--accent)] [font-family:var(--font-serif)]">
              The shadow draft now matches the canonical draft line for line.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-[560px] min-w-0 flex-1 flex-col bg-[color:var(--paper)]">
      <div className="border-b border-[color:var(--line)] px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
              Pending review
            </p>
            <h2 className="mt-2 text-2xl text-[color:var(--accent)] [font-family:var(--font-serif)]">
              Full document diff
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--muted)]">
              Review the entire draft like a code diff, then accept or reject
              individual changes or the whole shadow pass.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-full border border-[color:var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={isPending || selectedIndex <= 0}
              onClick={() => moveSelection(-1)}
              type="button"
            >
              Previous change
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
              Next change
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
      </div>

      <div className="grid min-h-0 flex-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-h-[420px] xl:min-h-0">
          <MonacoDiffView
            modified={shadow}
            onMount={handleMount}
            original={canonical}
          />
        </div>

        <div className="min-h-0 rounded-[24px] border border-[color:var(--line)] bg-white">
          <div className="border-b border-[color:var(--line)] px-4 py-4">
            <p className="text-sm font-semibold text-[color:var(--accent)]">
              {hunks.length} pending {hunks.length === 1 ? "change" : "changes"}
            </p>
            {selectedHunk ? (
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                Change at lines {selectedHunk.canonicalStartLine} /{" "}
                {selectedHunk.shadowStartLine}
              </p>
            ) : null}
          </div>

          <div className="max-h-[460px] space-y-3 overflow-auto p-4 xl:max-h-[calc(100vh-23rem)]">
            {hunks.map((hunk, index) => {
              const isSelected = hunk.id === selectedHunk?.id;

              return (
                <section
                  key={hunk.id}
                  className={`rounded-[20px] border p-3 transition ${
                    isSelected
                      ? "border-[color:var(--accent)] bg-[color:rgba(24,58,55,0.06)]"
                      : "border-[color:var(--line)] bg-[color:var(--paper)]"
                  }`}
                >
                  <button
                    className="w-full text-left"
                    onClick={() => revealHunk(hunk)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[color:var(--accent)]">
                        Change {index + 1}
                      </p>
                      <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        {hunk.kind}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                      {summarizeHunk(hunk)}
                    </p>
                  </button>

                  <div className="mt-3 flex gap-2">
                    <button
                      className="rounded-full bg-[color:var(--accept)] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={isPending || !onAcceptHunk}
                      onClick={() => onAcceptHunk?.(hunk.id)}
                      type="button"
                    >
                      {isPending ? "Applying…" : "Accept"}
                    </button>
                    <button
                      className="rounded-full border border-[color:var(--line)] px-3 py-2 text-sm font-semibold text-[color:var(--reject)] disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={isPending || !onRejectHunk}
                      onClick={() => onRejectHunk?.(hunk.id)}
                      type="button"
                    >
                      {isPending ? "Applying…" : "Reject"}
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
