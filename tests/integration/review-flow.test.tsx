import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceApp } from "@/src/components/workspace/workspace-app";

vi.mock("@/src/components/workspace/monaco-diff-view", () => ({
  MonacoDiffView: () => <div data-testid="monaco-diff-view">diff</div>
}));

describe("review flow", () => {
  it("loads the canonical draft into a direct markdown editor and opens review in that same surface", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          canonical: "# Draft\n\nHello world.",
          shadow: "# Draft\n\nHello revised world.",
          hunks: [
            {
              id: "hunk-0",
              kind: "modified",
              canonicalStartLine: 3,
              shadowStartLine: 3,
              segments: [
                { type: "removed", value: "Hello world." },
                { type: "added", value: "Hello revised world." }
              ]
            }
          ],
          versions: [
            {
              id: "version-0",
              createdAt: "2026-03-24T18:00:00.000Z",
              label: "Saved canonical draft",
              preview: "Hello world.",
              source: "manual"
            }
          ]
        })
      });

    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<WorkspaceApp />);

    await waitFor(() =>
      expect(screen.getByRole("textbox")).toHaveValue("# Draft\n\nHello world.")
    );

    expect(screen.queryByRole("heading", { name: /^draft$/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /review/i }));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByTestId("monaco-diff-view")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^accept$/i })).toBeEnabled();
  });

  it("keeps review open while hunks still remain after a partial decision", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          canonical: "# Draft\n\nHello world.\nKeep this line.",
          shadow: "# Draft\n\nHello revised world.\nKeep this line revised.",
          hunks: [
            {
              id: "hunk-0",
              kind: "modified",
              canonicalStartLine: 3,
              shadowStartLine: 3,
              segments: [
                { type: "removed", value: "Hello world.\n" },
                { type: "added", value: "Hello revised world.\n" }
              ]
            },
            {
              id: "hunk-1",
              kind: "modified",
              canonicalStartLine: 4,
              shadowStartLine: 4,
              segments: [
                { type: "removed", value: "Keep this line." },
                { type: "added", value: "Keep this line revised." }
              ]
            }
          ],
          versions: [
            {
              id: "version-0",
              createdAt: "2026-03-24T18:00:00.000Z",
              label: "Saved canonical draft",
              preview: "Hello world.",
              source: "manual"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          canonical: "# Draft\n\nHello revised world.\nKeep this line.",
          shadow: "# Draft\n\nHello revised world.\nKeep this line revised.",
          hunks: [
            {
              id: "hunk-1",
              kind: "modified",
              canonicalStartLine: 4,
              shadowStartLine: 4,
              segments: [
                { type: "removed", value: "Keep this line." },
                { type: "added", value: "Keep this line revised." }
              ]
            }
          ],
          versions: [
            {
              id: "version-1",
              createdAt: "2026-03-24T18:10:00.000Z",
              label: "Applied reviewed changes",
              preview: "Hello revised world.",
              source: "review"
            }
          ]
        })
      });

    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<WorkspaceApp />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /review/i })).toBeEnabled()
    );

    await user.click(screen.getByRole("button", { name: /review/i }));
    await user.click(screen.getAllByRole("button", { name: /^accept$/i })[0]);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledTimes(2)
    );

    expect(screen.getByTestId("monaco-diff-view")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    const closeReviewButton = screen.queryByRole("button", {
      name: /close review/i
    });

    if (closeReviewButton) {
      expect(closeReviewButton).toBeDisabled();
    } else {
      expect(
        screen.queryByRole("button", { name: /review changes/i })
      ).not.toBeInTheDocument();
    }

    expect(screen.getByText(/1 pending change/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "http://localhost:3000/api/workspace/review"
    );
  });

  it("allows returning to the editor only after every hunk is resolved", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          canonical: "# Draft\n\nCurrent version.",
          shadow: "# Draft\n\nCurrent revised version.",
          hunks: [
            {
              id: "hunk-0",
              kind: "modified",
              canonicalStartLine: 3,
              shadowStartLine: 3,
              segments: [
                { type: "removed", value: "Current version." },
                { type: "added", value: "Current revised version." }
              ]
            }
          ],
          versions: [
            {
              id: "version-current",
              createdAt: "2026-03-24T18:10:00.000Z",
              label: "Saved canonical draft",
              preview: "Current version.",
              source: "manual"
            },
            {
              id: "version-older",
              createdAt: "2026-03-24T17:10:00.000Z",
              label: "Initial draft",
              preview: "Older version.",
              source: "initial"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          canonical: "# Draft\n\nCurrent revised version.",
          shadow: "# Draft\n\nCurrent revised version.",
          hunks: [],
          versions: [
            {
              id: "version-review",
              createdAt: "2026-03-24T18:12:00.000Z",
              label: "Applied reviewed changes",
              preview: "Current revised version.",
              source: "review"
            }
          ]
        })
      });

    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<WorkspaceApp />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /review/i })).toBeEnabled()
    );

    await user.click(screen.getByRole("button", { name: /review/i }));
    await user.click(screen.getByRole("button", { name: /^accept$/i }));

    await waitFor(() =>
      expect(screen.getByText(/review complete/i)).toBeInTheDocument()
    );

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /back to editor/i })
    ).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /back to editor/i }));

    await waitFor(() =>
      expect(screen.getByRole("textbox")).toHaveValue(
        "# Draft\n\nCurrent revised version."
      )
    );

    expect(screen.queryByTestId("monaco-diff-view")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /review/i })).toBeDisabled();
  });
});
