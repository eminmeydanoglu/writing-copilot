import React from "react";

export function StatusBar({
  pendingChanges,
  versionCount,
  latestLabel,
  isDirty = false,
  isReviewOpen = false
}: {
  pendingChanges: number;
  versionCount: number;
  latestLabel?: string;
  isDirty?: boolean;
  isReviewOpen?: boolean;
}) {
  return (
    <footer className="flex flex-col gap-2 border-t border-[color:var(--line)] px-6 py-3 text-sm text-[color:var(--muted)] md:flex-row md:items-center md:justify-between">
      <span>
        {isReviewOpen
          ? pendingChanges > 0
            ? `${pendingChanges} pending review changes remain`
            : "Review resolved. Return to the editor to keep writing."
          : pendingChanges > 0
            ? `${pendingChanges} pending changes in shadow draft`
            : isDirty
              ? "Canonical draft has unsaved edits"
              : "Shadow draft synced with canonical"}
      </span>
      <span>{latestLabel ? `${versionCount} saved versions · ${latestLabel}` : `${versionCount} saved versions`}</span>
    </footer>
  );
}
