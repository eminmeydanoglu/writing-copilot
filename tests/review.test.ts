import { diffDocuments } from "../src/lib/diff";
import {
  acceptAllReviewHunks,
  acceptReviewHunk,
  applyReviewDecisionSet,
  rejectAllReviewHunks,
  rejectReviewHunk
} from "../src/lib/review";

describe("review engine", () => {
  it("accepts one hunk and keeps undecided hunks pending", () => {
    const canonical = "alpha\nbeta\ngamma\ndelta\n";
    const shadow = "alpha\nbeta revised\ngamma\ndelta revised\n";
    const initialHunks = diffDocuments(canonical, shadow);

    const reviewed = acceptReviewHunk(
      canonical,
      shadow,
      initialHunks[0]!.id,
      initialHunks
    );

    expect(reviewed.canonical).toBe("alpha\nbeta revised\ngamma\ndelta\n");
    expect(reviewed.shadow).toBe("alpha\nbeta revised\ngamma\ndelta revised\n");
    expect(reviewed.hunks).toHaveLength(1);
    expect(reviewed.isComplete).toBe(false);
  });

  it("rejects one hunk by restoring canonical text into shadow for that region", () => {
    const canonical = "alpha\nbeta\ngamma\ndelta\n";
    const shadow = "alpha\nbeta revised\ngamma\ndelta revised\n";
    const initialHunks = diffDocuments(canonical, shadow);

    const reviewed = rejectReviewHunk(
      canonical,
      shadow,
      initialHunks[0]!.id,
      initialHunks
    );

    expect(reviewed.canonical).toBe(canonical);
    expect(reviewed.shadow).toBe("alpha\nbeta\ngamma\ndelta revised\n");
    expect(reviewed.hunks).toHaveLength(1);
  });

  it("resolves a mixed accept/reject pass into aligned canonical and shadow documents", () => {
    const canonical = "alpha\nbeta\ngamma\ndelta\n";
    const shadow = "alpha\nbeta revised\ngamma\ndelta revised\n";
    const initialHunks = diffDocuments(canonical, shadow);

    const reviewed = applyReviewDecisionSet(
      canonical,
      shadow,
      {
        [initialHunks[0]!.id]: "accept",
        [initialHunks[1]!.id]: "reject"
      },
      initialHunks
    );

    expect(reviewed.canonical).toBe("alpha\nbeta revised\ngamma\ndelta\n");
    expect(reviewed.shadow).toBe("alpha\nbeta revised\ngamma\ndelta\n");
    expect(reviewed.hunks).toEqual([]);
    expect(reviewed.isComplete).toBe(true);
  });

  it("supports accept all and reject all helpers", () => {
    const canonical = "alpha\nbeta\n";
    const shadow = "alpha revised\nbeta revised\n";

    expect(acceptAllReviewHunks(canonical, shadow)).toMatchObject({
      canonical: shadow,
      shadow,
      isComplete: true
    });
    expect(rejectAllReviewHunks(canonical, shadow)).toMatchObject({
      canonical,
      shadow: canonical,
      isComplete: true
    });
  });

  it("rejects stale or unknown hunk ids instead of silently applying them", () => {
    expect(() =>
      applyReviewDecisionSet("alpha\n", "beta\n", { "hunk-99": "accept" })
    ).toThrow(/unknown review hunk id/i);
  });

  it("rejects stale hunk snapshots even when ids are shape-compatible", () => {
    const staleHunks = diffDocuments("alpha\nbeta\n", "alpha revised\nbeta\n");

    expect(() =>
      applyReviewDecisionSet(
        "gamma\ndelta\n",
        "gamma revised\ndelta\n",
        { [staleHunks[0]!.id]: "accept" },
        staleHunks
      )
    ).toThrow(/stale/i);
  });

  it("handles pure additions and removals symmetrically during review", () => {
    const additionCanonical = "alpha\n";
    const additionShadow = "alpha\nbeta\n";
    const additionHunks = diffDocuments(additionCanonical, additionShadow);
    const removalCanonical = "alpha\nbeta\n";
    const removalShadow = "alpha\n";
    const removalHunks = diffDocuments(removalCanonical, removalShadow);

    expect(
      acceptReviewHunk(
        additionCanonical,
        additionShadow,
        additionHunks[0]!.id,
        additionHunks
      )
    ).toMatchObject({
      canonical: additionShadow,
      shadow: additionShadow,
      isComplete: true
    });
    expect(
      rejectReviewHunk(
        additionCanonical,
        additionShadow,
        additionHunks[0]!.id,
        additionHunks
      )
    ).toMatchObject({
      canonical: additionCanonical,
      shadow: additionCanonical,
      isComplete: true
    });
    expect(
      acceptReviewHunk(
        removalCanonical,
        removalShadow,
        removalHunks[0]!.id,
        removalHunks
      )
    ).toMatchObject({
      canonical: removalShadow,
      shadow: removalShadow,
      isComplete: true
    });
    expect(
      rejectReviewHunk(
        removalCanonical,
        removalShadow,
        removalHunks[0]!.id,
        removalHunks
      )
    ).toMatchObject({
      canonical: removalCanonical,
      shadow: removalCanonical,
      isComplete: true
    });
  });
});
