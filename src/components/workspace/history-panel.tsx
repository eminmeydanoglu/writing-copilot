"use client";

import React from "react";
import type { WorkspaceVersion } from "@/src/lib/workspace/types";

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function HistoryPanel({
  versions,
  onRestoreVersion,
  isPending = false
}: {
  versions: WorkspaceVersion[];
  onRestoreVersion?: (versionId: string) => void;
  isPending?: boolean;
}) {
  return (
    <section
      aria-label="Version history"
      className="w-full max-w-[360px] rounded-[26px] border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 shadow-[0_24px_60px_rgba(17,24,21,0.16)] backdrop-blur"
    >
      <div className="border-b border-[color:var(--line)] pb-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
          History
        </p>
        <h2 className="mt-2 text-xl text-[color:var(--accent)] [font-family:var(--font-serif)]">
          Canonical versions
        </h2>
        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
          Every canonical state is saved locally. Restore any earlier version in
          one click.
        </p>
      </div>

      <div className="mt-4 max-h-[420px] space-y-3 overflow-auto pr-1">
        {versions.map((version, index) => (
          <article
            key={version.id}
            className="rounded-[20px] border border-[color:var(--line)] bg-white px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[color:var(--accent)]">
                  {version.label}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                  {version.source} · {formatTimestamp(version.createdAt)}
                </p>
              </div>
              {index === 0 ? (
                <span className="rounded-full bg-[color:var(--accent)] px-2.5 py-1 text-xs font-semibold text-white">
                  Current
                </span>
              ) : (
                <button
                  className="rounded-full border border-[color:var(--line)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent)] transition hover:border-[color:var(--accent)] hover:bg-[color:var(--paper)] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={isPending || !onRestoreVersion}
                  onClick={() => onRestoreVersion?.(version.id)}
                  type="button"
                >
                  {isPending ? "Working…" : "Restore"}
                </button>
              )}
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--text)]">
              {version.preview}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
