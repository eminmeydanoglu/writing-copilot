"use client";

import React, { useState } from "react";
import { EditorPane } from "@/src/components/workspace/editor-pane";
import { HistoryPanel } from "@/src/components/workspace/history-panel";
import { ReviewDrawer } from "@/src/components/workspace/review-drawer";
import { StatusBar } from "@/src/components/workspace/status-bar";
import type { DiffHunk, WorkspaceVersion } from "@/src/lib/workspace/types";

export function WorkspaceShell({
  canonical,
  draft,
  shadow,
  hunks,
  versions,
  isReviewOpen,
  onToggleReview,
  onDraftChange,
  onSaveDraft,
  onAcceptHunk,
  onRejectHunk,
  onAcceptAll,
  onRejectAll,
  onRestoreVersion,
  isMutating = false,
  errorMessage,
  isDirty = false
}: {
  canonical: string;
  draft: string;
  shadow: string;
  hunks: DiffHunk[];
  versions: WorkspaceVersion[];
  isReviewOpen: boolean;
  onToggleReview?: () => void;
  onDraftChange?: (markdown: string) => void;
  onSaveDraft?: () => void;
  onAcceptHunk?: (hunkId: string) => void;
  onRejectHunk?: (hunkId: string) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  onRestoreVersion?: (versionId: string) => void;
  isMutating?: boolean;
  errorMessage?: string | null;
  isDirty?: boolean;
}) {
  const pendingChanges = hunks.length;
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const isHistoryDisabled = isMutating || isReviewOpen || isDirty || versions.length === 0;
  const isReviewToggleDisabled = isMutating
    || (!isReviewOpen && (pendingChanges === 0 || isDirty))
    || (isReviewOpen && pendingChanges > 0);
  const reviewButtonLabel = isReviewOpen
    ? pendingChanges > 0
      ? "Resolve changes to return"
      : "Back to editor"
    : isDirty
      ? "Save draft to review"
      : "Review changes";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1480px] flex-col overflow-hidden rounded-[30px] border border-[color:var(--line)] bg-[color:var(--panel)] shadow-[0_30px_90px_rgba(31,35,33,0.12)]">
      <header className="relative flex flex-col gap-4 border-b border-[color:var(--line)] px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--muted)]">
            Workspace
          </p>
          <h1 className="mt-2 text-3xl text-[color:var(--accent)] [font-family:var(--font-serif)]">
            Writing Copilot
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
            Keep the canonical draft stable, review the shadow pass as a full
            diff, and restore any saved version without leaving the page.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={isHistoryDisabled}
            onClick={() => setIsHistoryOpen((current) => !current)}
            type="button"
          >
            {isHistoryOpen ? "Hide history" : "History"}
          </button>
          <button
            className="rounded-full border border-[color:var(--line)] bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            disabled={isReviewToggleDisabled}
            onClick={onToggleReview}
            type="button"
          >
            {reviewButtonLabel}
          </button>
        </div>

        {errorMessage ? (
          <div className="w-full rounded-[20px] border border-[color:rgba(140,59,47,0.18)] bg-[color:rgba(140,59,47,0.08)] px-4 py-3 text-sm text-[color:var(--reject)] lg:order-last">
            {errorMessage}
          </div>
        ) : null}

        {isHistoryOpen ? (
          <div className="right-6 top-[calc(100%-0.5rem)] z-20 w-full max-w-[360px] lg:absolute">
            <HistoryPanel
              isPending={isMutating}
              onRestoreVersion={onRestoreVersion}
              versions={versions}
            />
          </div>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1">
        {isReviewOpen ? (
          <ReviewDrawer
            canonical={canonical}
            hunks={hunks}
            isOpen={isReviewOpen}
            isPending={isMutating}
            onAcceptAll={onAcceptAll}
            onAcceptHunk={onAcceptHunk}
            onRejectAll={onRejectAll}
            onRejectHunk={onRejectHunk}
            shadow={shadow}
          />
        ) : (
          <EditorPane
            draft={draft}
            isDirty={isDirty}
            isSaving={isMutating}
            onChange={onDraftChange}
            onSave={onSaveDraft}
            pendingChanges={pendingChanges}
          />
        )}
      </div>

      <StatusBar
        isDirty={isDirty}
        isReviewOpen={isReviewOpen}
        latestLabel={versions[0]?.label}
        pendingChanges={pendingChanges}
        versionCount={versions.length}
      />
    </div>
  );
}
