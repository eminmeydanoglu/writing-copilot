import { diffDocuments } from "../src/lib/diff";

describe("diff engine", () => {
  it("creates separate hunks for separate line edits", () => {
    const hunks = diffDocuments(
      "alpha\nbeta\ngamma\ndelta\n",
      "alpha\nbeta revised\ngamma\ndelta revised\n"
    );

    expect(hunks).toHaveLength(2);
    expect(hunks.map((hunk) => hunk.kind)).toEqual(["modified", "modified"]);
    expect(hunks.map((hunk) => hunk.canonicalStartLine)).toEqual([2, 4]);
    expect(hunks.map((hunk) => hunk.shadowStartLine)).toEqual([2, 4]);
  });

  it("supports pure additions and removals", () => {
    const added = diffDocuments("alpha\n", "alpha\nbeta\n");
    const removed = diffDocuments("alpha\nbeta\n", "alpha\n");

    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      kind: "added",
      canonicalStartLine: 2,
      canonicalLineCount: 0,
      shadowStartLine: 2,
      shadowLineCount: 1
    });
    expect(removed).toHaveLength(1);
    expect(removed[0]).toMatchObject({
      kind: "removed",
      canonicalStartLine: 2,
      canonicalLineCount: 1,
      shadowStartLine: 2,
      shadowLineCount: 0
    });
  });

  it("returns no hunks when the documents are identical", () => {
    expect(diffDocuments("alpha\nbeta\n", "alpha\nbeta\n")).toEqual([]);
  });

  it("tracks leading and trailing edits predictably", () => {
    const hunks = diffDocuments(
      "alpha\nbeta\ngamma\n",
      "preface\nalpha\nbeta\ngamma revised\n"
    );

    expect(hunks).toHaveLength(2);
    expect(hunks[0]).toMatchObject({
      kind: "added",
      canonicalStartLine: 1,
      shadowStartLine: 1
    });
    expect(hunks[1]).toMatchObject({
      kind: "modified",
      canonicalStartLine: 3,
      shadowStartLine: 4
    });
  });

  it("keeps a single whitespace edit scoped to one line", () => {
    const hunks = diffDocuments(
      "alpha\nbeta\ngamma\n",
      "alpha\nbeta \ngamma\n"
    );

    expect(hunks).toHaveLength(1);
    expect(hunks[0]).toMatchObject({
      kind: "modified",
      canonicalStartLine: 2,
      canonicalLineCount: 1,
      shadowStartLine: 2,
      shadowLineCount: 1
    });
  });
});
