import React from "react";
import { render, screen } from "@testing-library/react";
import { WorkspaceShell } from "@/src/components/workspace/workspace-shell";
import type { DiffHunk, WorkspaceVersion } from "@/src/lib/workspace/types";

vi.mock("@/src/components/workspace/monaco-diff-view", () => ({
  MonacoDiffView: () => <div data-testid="monaco-diff-view">Mock diff editor</div>
}));

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
  it("renders the canonical markdown as editable source in the main surface", () => {
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
        onSaveDraft={() => {}}
        shadow={`# Draft

Hello world.`}
        versions={sampleVersions}
      />
    );

    expect(screen.getByRole("textbox")).toHaveValue(`# Draft

Hello world.`);
    expect(screen.queryByRole("heading", { name: /^draft$/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("monaco-diff-view")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /review changes/i })).toBeEnabled();
  });

  it("uses that same main surface for review instead of showing the editor and diff together", () => {
    render(
      <WorkspaceShell
        canonical={`# Draft

Hello world.`}
        draft={`# Draft

Hello world.`}
        hunks={sampleHunks}
        isReviewOpen
        onDraftChange={() => {}}
        onSaveDraft={() => {}}
        shadow={`# Draft

Hello revised world.`}
        versions={sampleVersions}
      />
    );

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText(/full document diff/i)).toBeInTheDocument();
    expect(screen.getByTestId("monaco-diff-view")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /accept all/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^draft$/i })).not.toBeInTheDocument();
  });
});
