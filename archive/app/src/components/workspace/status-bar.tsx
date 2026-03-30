import React from "react";

export function StatusBar({
  pendingChanges,
  versionCount,
  latestLabel,
  saveState = "idle",
  isReviewOpen = false
}: {
  pendingChanges: number;
  versionCount: number;
  latestLabel?: string;
  saveState?: "idle" | "dirty" | "saving" | "saved" | "error";
  isReviewOpen?: boolean;
}) {
  return (
    <footer className="flex flex-col gap-2 border-t border-[color:var(--line)] px-6 py-3 text-sm text-[color:var(--muted)] md:flex-row md:items-center md:justify-between">
      <span>
        {isReviewOpen
          ? pendingChanges > 0
            ? `${pendingChanges} suggestions remain in this review pass`
            : "Review resolved. Returning to the draft keeps shadow in sync."
          : pendingChanges > 0
          ? `${pendingChanges} pending suggestions`
            : saveState === "dirty"
              ? "Autosave pending"
            : saveState === "saving"
              ? "Autosaving canonical draft"
              : saveState === "saved"
                ? "Canonical draft autosaved"
                : saveState === "error"
                  ? "Autosave failed"
                  : "Draft and shadow are aligned"}
      </span>
      <span>{latestLabel ? `${versionCount} saved versions · ${latestLabel}` : `${versionCount} saved versions`}</span>
    </footer>
  );
}
