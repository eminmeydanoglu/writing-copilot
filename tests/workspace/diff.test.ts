import { applyHunkDecisions, diffDocuments } from "@/src/lib/workspace/diff";

describe("workspace diff", () => {
  it("creates separate hunks for separate line edits", () => {
    const hunks = diffDocuments(
      "alpha\nbeta\ngamma\ndelta\n",
      "alpha\nbeta revised\ngamma\ndelta revised\n"
    );

    expect(hunks).toHaveLength(2);
    expect(hunks.map((hunk) => hunk.kind)).toEqual(["modified", "modified"]);
  });

  it("reconstructs a merged document from mixed accept and reject decisions", () => {
    const canonical = "alpha\nbeta\ngamma\ndelta\n";
    const shadow = "alpha\nbeta revised\ngamma\ndelta revised\n";
    const hunks = diffDocuments(canonical, shadow);

    const merged = applyHunkDecisions(canonical, shadow, hunks, {
      [hunks[0].id]: "accept",
      [hunks[1].id]: "reject"
    });

    expect(merged).toBe("alpha\nbeta revised\ngamma\ndelta\n");
  });
});
