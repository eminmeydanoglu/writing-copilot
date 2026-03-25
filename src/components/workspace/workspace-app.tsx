"use client";

import React, { useEffect, useState } from "react";
import { WorkspaceShell } from "@/src/components/workspace/workspace-shell";
import type { WorkspaceState } from "@/src/lib/workspace/types";

const EMPTY_WORKSPACE: WorkspaceState = {
  canonical: "# Untitled Draft\n\nStart writing here.",
  shadow: "# Untitled Draft\n\nStart writing here.",
  hunks: [],
  versions: []
};

function toApiUrl(pathname: string): string {
  if (typeof window === "undefined") {
    return pathname;
  }

  return new URL(pathname, window.location.origin).toString();
}

function isWorkspaceState(payload: unknown): payload is WorkspaceState {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const candidate = payload as Record<string, unknown>;

  return (
    typeof candidate.canonical === "string" &&
    typeof candidate.shadow === "string" &&
    Array.isArray(candidate.hunks) &&
    Array.isArray(candidate.versions)
  );
}

async function parseWorkspaceResponse(response: Response): Promise<WorkspaceState> {
  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "Workspace request failed.";

    throw new Error(message);
  }

  if (!isWorkspaceState(payload)) {
    throw new Error("Workspace response was invalid.");
  }

  return payload;
}

export function WorkspaceApp() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(EMPTY_WORKSPACE);
  const [draft, setDraft] = useState(EMPTY_WORKSPACE.canonical);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isDirty = draft !== workspace.canonical;

  useEffect(() => {
    setDraft(workspace.canonical);
  }, [workspace.canonical]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      try {
        const response = await fetch(toApiUrl("/api/workspace"));
        const payload = await parseWorkspaceResponse(response);

        if (!cancelled) {
          setErrorMessage(null);
          setWorkspace(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setWorkspace(EMPTY_WORKSPACE);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Could not load the workspace."
          );
        }
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, []);

  async function applyDecision(
    decisions: Record<string, "accept" | "reject">
  ): Promise<void> {
    if (isMutating || Object.keys(decisions).length === 0) {
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);

    try {
      const response = await fetch(toApiUrl("/api/workspace/review"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          decisions
        })
      });

      const payload = await parseWorkspaceResponse(response);
      setWorkspace(payload);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not apply review decisions."
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function restoreVersion(versionId: string): Promise<void> {
    if (isMutating) {
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        toApiUrl(`/api/workspace/versions/${versionId}/restore`),
        {
          method: "POST"
        }
      );

      const payload = await parseWorkspaceResponse(response);
      setWorkspace(payload);
      setIsReviewOpen(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not restore this version."
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function saveDraft(): Promise<void> {
    if (isMutating || isReviewOpen || workspace.hunks.length > 0 || !isDirty) {
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);

    try {
      const response = await fetch(toApiUrl("/api/workspace"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          canonical: draft
        })
      });

      const payload = await parseWorkspaceResponse(response);
      setWorkspace(payload);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not save the draft."
      );
    } finally {
      setIsMutating(false);
    }
  }

  function toggleReview(): void {
    if (isReviewOpen) {
      if (workspace.hunks.length > 0) {
        setErrorMessage("Resolve all pending changes before returning to the editor.");
        return;
      }

      setErrorMessage(null);
      setIsReviewOpen(false);
      return;
    }

    if (isDirty) {
      setErrorMessage("Save the canonical draft before opening review.");
      return;
    }

    if (workspace.hunks.length === 0) {
      return;
    }

    setErrorMessage(null);
    setIsReviewOpen(true);
  }

  return (
    <WorkspaceShell
      canonical={workspace.canonical}
      draft={draft}
      errorMessage={errorMessage}
      hunks={workspace.hunks}
      isDirty={isDirty}
      isMutating={isMutating}
      isReviewOpen={isReviewOpen}
      onDraftChange={setDraft}
      onAcceptAll={() =>
        void applyDecision(
          Object.fromEntries(workspace.hunks.map((hunk) => [hunk.id, "accept"]))
        )
      }
      onAcceptHunk={(hunkId) =>
        void applyDecision({
          [hunkId]: "accept"
        })
      }
      onRejectAll={() =>
        void applyDecision(
          Object.fromEntries(workspace.hunks.map((hunk) => [hunk.id, "reject"]))
        )
      }
      onRejectHunk={(hunkId) =>
        void applyDecision({
          [hunkId]: "reject"
        })
      }
      onRestoreVersion={(versionId) => void restoreVersion(versionId)}
      onSaveDraft={() => void saveDraft()}
      onToggleReview={toggleReview}
      shadow={workspace.shadow}
      versions={workspace.versions}
    />
  );
}
