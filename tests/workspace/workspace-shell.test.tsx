import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { WorkspaceShell } from "@/src/components/workspace/workspace-shell";
import type { DiffHunk, WorkspaceVersion } from "@/src/lib/workspace/types";

const sampleHunks: DiffHunk[] = [
  {
    id: "hunk-0",
    kind: "modified",
    canonicalStartLine: 2,
    shadowStartLine: 2,
    segments: [
      { type: "removed", value: "beta\n" },
      { type: "added", value: "beta revised\n" }
    ]
  }
];

const sampleVersions: WorkspaceVersion[] = [
  {
    id: "version-current",
    createdAt: "2026-03-24T18:00:00.000Z",
    label: "Saved canonical draft",
    preview: "Current draft preview",
    source: "manual"
  },
  {
    id: "version-older",
    createdAt: "2026-03-23T18:00:00.000Z",
    label: "Initial draft",
    preview: "Older draft preview",
    source: "initial"
  }
];

describe("workspace shell", () => {
  it("renders a single writing surface and keeps review conditional", () => {
    render(
      <WorkspaceShell
        canonical={`# Draft

Hello world.`}
        draft={`# Draft

Hello world.`}
        hunks={sampleHunks}
        isReviewOpen={false}
        onDraftChange={() => {}}
        onRestoreVersion={() => {}}
        onToggleReview={() => {}}
        shadow={`# Draft

Hello world.`}
        versions={sampleVersions}
      />
    );

    expect(screen.getByText("Hello world.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^read$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /review 1/i })).toBeEnabled();
    expect(screen.queryByTestId("monaco-diff-editor")).not.toBeInTheDocument();
  });

  it("opens review in the same surface with inline diff controls", async () => {
    render(
      <WorkspaceShell
        canonical={`# Draft

Hello world.`}
        draft={`# Draft

Hello world.`}
        hunks={sampleHunks}
        isReviewOpen
        onAcceptAll={() => {}}
        onAcceptHunk={() => {}}
        onRejectAll={() => {}}
        onRejectHunk={() => {}}
        onToggleReview={() => {}}
        shadow={`# Draft

Hello revised world.`}
        versions={sampleVersions}
      />
    );

    expect(screen.getByText(/inline review/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to draft/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^accept change$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^reject change$/i })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("monaco-diff-editor")).toBeInTheDocument()
    );
    expect(
      screen.queryByRole("textbox", { name: /draft markdown/i })
    ).not.toBeInTheDocument();
  });
});
