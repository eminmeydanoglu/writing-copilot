import {
  ensureSelectedHunkId,
  findHunkIdAtLine,
  getHunkLineRange,
  getSelectedHunkIndex
} from "../src/lib/diff-mode";
import { diffDocuments } from "../src/lib/diff";

describe("diff mode helpers", () => {
  it("returns line ranges for both sides of a hunk", () => {
    const [hunk] = diffDocuments("alpha\nbeta\n", "alpha revised\nbeta\n");

    expect(getHunkLineRange(hunk!, "canonical")).toEqual({
      startLine: 1,
      endLine: 1
    });
    expect(getHunkLineRange(hunk!, "shadow")).toEqual({
      startLine: 1,
      endLine: 1
    });
  });

  it("finds the hunk at a given line for each side", () => {
    const hunks = diffDocuments(
      "alpha\nbeta\ngamma\ndelta\n",
      "alpha\nbeta revised\ngamma\ndelta revised\n"
    );

    expect(findHunkIdAtLine(hunks, "canonical", 2)).toBe(hunks[0]?.id);
    expect(findHunkIdAtLine(hunks, "shadow", 4)).toBe(hunks[1]?.id);
    expect(findHunkIdAtLine(hunks, "canonical", 3)).toBeNull();
  });

  it("normalizes selected hunk ids against the current hunk set", () => {
    const hunks = diffDocuments("alpha\nbeta\n", "alpha\nbeta revised\n");

    expect(ensureSelectedHunkId(hunks, null)).toBe(hunks[0]?.id);
    expect(ensureSelectedHunkId(hunks, hunks[0]?.id ?? null)).toBe(hunks[0]?.id);
    expect(ensureSelectedHunkId(hunks, "missing")).toBe(hunks[0]?.id);
    expect(getSelectedHunkIndex(hunks, hunks[0]?.id ?? null)).toBe(0);
  });
});
