import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import HomePage from "@/app/page";

describe("app shell", () => {
  it("renders the direct markdown workspace editor", async () => {
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
      expect(screen.getByRole("textbox")).toHaveValue("# Draft\n\nHello world.")
    );

    expect(
      screen.getByRole("heading", { name: /writing copilot/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^draft$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /review/i })).toBeDisabled();
  });
});
