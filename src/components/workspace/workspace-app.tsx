"use client";

import React, { useEffect, useRef, useState } from "react";
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
  const [saveState, setSaveState] = useState<
    "idle" | "dirty" | "saving" | "saved" | "error"
  >("idle");
  const [hasLoaded, setHasLoaded] = useState(false);
  const workspaceRef = useRef(workspace);
  const draftRef = useRef(draft);
  const isDirty = draft !== workspace.canonical;

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace(passive = false) {
      try {
        const response = await fetch(toApiUrl("/api/workspace"));
        const payload = await parseWorkspaceResponse(response);

        if (!cancelled) {
          setErrorMessage(null);
          setWorkspace(payload);
          setHasLoaded(true);
          setDraft((current) => {
            const currentWorkspace = workspaceRef.current;
            const shouldOverwrite =
              !passive || current === currentWorkspace.canonical;

            return shouldOverwrite ? payload.canonical : current;
          });
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

    void loadWorkspace(false);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoaded || isMutating || isDirty || isReviewOpen) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(toApiUrl("/api/workspace"));
          const payload = await parseWorkspaceResponse(response);
          setErrorMessage(null);
          setWorkspace(payload);
          setDraft((current) =>
            current === workspaceRef.current.canonical ? payload.canonical : current
          );
        } catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Could not refresh the workspace."
          );
        }
      })();
    }, 1500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasLoaded, isDirty, isMutating, isReviewOpen]);

  useEffect(() => {
    if (!hasLoaded || isReviewOpen || !isDirty) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveDraft(draftRef.current);
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [draft, hasLoaded, isDirty, isReviewOpen, workspace.hunks.length]);

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
      setDraft(payload.canonical);
      if (payload.hunks.length === 0) {
        setIsReviewOpen(false);
      }
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
      setDraft(payload.canonical);
      setIsReviewOpen(false);
      setSaveState("saved");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not restore this version."
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function saveDraft(nextDraft: string): Promise<boolean> {
    if (isMutating) {
      return false;
    }

    setIsMutating(true);
    setErrorMessage(null);
    setSaveState("saving");

    try {
      const response = await fetch(toApiUrl("/api/workspace"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          canonical: nextDraft
        })
      });

      const payload = await parseWorkspaceResponse(response);
      setWorkspace(payload);
      setDraft((current) => (current === nextDraft ? payload.canonical : current));
      setSaveState("saved");
      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not save the draft."
      );
      setSaveState("error");
      return false;
    } finally {
      setIsMutating(false);
    }
  }

  async function toggleReview(): Promise<void> {
    if (isReviewOpen) {
      setErrorMessage(null);
      setIsReviewOpen(false);
      return;
    }

    if (workspace.hunks.length === 0) {
      return;
    }

    if (isDirty) {
      const didSave = await saveDraft(draftRef.current);

      if (!didSave) {
        return;
      }
    }

    setErrorMessage(null);
    setIsReviewOpen(true);
  }

  function handleDraftChange(nextDraft: string): void {
    setDraft(nextDraft);
    setSaveState("dirty");
    setErrorMessage(null);
  }

  return (
    <WorkspaceShell
      canonical={workspace.canonical}
      draft={draft}
      errorMessage={errorMessage}
      hunks={workspace.hunks}
      isMutating={isMutating}
      isReviewOpen={isReviewOpen}
      onDraftChange={handleDraftChange}
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
      onToggleReview={() => void toggleReview()}
      saveState={saveState}
      shadow={workspace.shadow}
      versions={workspace.versions}
    />
  );
}
