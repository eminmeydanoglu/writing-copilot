import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceApp } from "@/src/components/workspace/workspace-app";

describe("review flow", () => {
  it("autosaves source edits inside the main markdown surface", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          canonical: "# Draft\n\nHello world.",
          shadow: "# Draft\n\nHello world.",
          hunks: [],
          versions: []
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          canonical: "# Draft\n\nHello world.\n\nA new line.",
          shadow: "# Draft\n\nHello world.\n\nA new line.",
          hunks: [],
          versions: [
            {
              id: "version-1",
              createdAt: "2026-03-25T10:00:00.000Z",
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
      expect(screen.getByText("Hello world.")).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    await user.type(
      screen.getByRole("textbox", { name: /draft markdown/i }),
      "\n\nA new line."
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), {
      timeout: 3000
    });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT"
    });
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /draft markdown/i })).toHaveValue(
        "# Draft\n\nHello world.\n\nA new line."
      )
    );
  });

  it("refreshes the writing surface when draft.md changes externally", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          canonical: "# Draft\n\nFirst version.",
          shadow: "# Draft\n\nFirst version.",
          hunks: [],
          versions: []
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          canonical: "# Draft\n\nExternally updated version.",
          shadow: "# Draft\n\nExternally updated version.",
          hunks: [],
          versions: []
        })
      });

    vi.stubGlobal("fetch", fetchMock);
    render(<WorkspaceApp />);

    await waitFor(() =>
      expect(screen.getByText("First version.")).toBeInTheDocument()
    );

    await waitFor(
      () => expect(screen.getByText("Externally updated version.")).toBeInTheDocument(),
      {
        timeout: 4000
      }
    );
  });

  it("opens review in the same document stage and accepts a chunk", async () => {
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
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          canonical: "# Draft\n\nHello revised world.",
          shadow: "# Draft\n\nHello revised world.",
          hunks: [],
          versions: [
            {
              id: "version-review",
              createdAt: "2026-03-24T18:12:00.000Z",
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
      expect(screen.getByRole("button", { name: /review 1/i })).toBeEnabled()
    );

    await user.click(screen.getByRole("button", { name: /review 1/i }));
    expect(screen.getByText(/inline review/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^accept change$/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^accept change$/i }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /review 1/i })).not.toBeInTheDocument()
    );
    expect(screen.getByText("Hello revised world.")).toBeInTheDocument();
  });
});
