import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import HomePage from "@/app/page";

describe("app shell", () => {
  it("renders the canonical draft in a single writing surface by default", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          canonical: "# Draft\n\nHello world.",
          shadow: "# Draft\n\nHello world.",
          hunks: [],
          versions: []
        })
      })
    );

    render(<HomePage />);

    await waitFor(() =>
      expect(screen.getByText("Hello world.")).toBeInTheDocument()
    );

    expect(
      screen.getByRole("heading", { name: /writing copilot/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^read$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /review/i })).not.toBeInTheDocument();
  });
});
