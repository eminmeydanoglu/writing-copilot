import { diffDocuments } from "../src/lib/diff";
import { acceptReviewHunk, rejectReviewHunk } from "../src/lib/review";
import { syncShadowWithCanonicalChange } from "../src/lib/shadow-sync";

describe("draft/shadow workflow", () => {
  it("does not surface manual draft edits as AI diffs when shadow was aligned", () => {
    const previousDraft = "intro\nbody\n";
    const nextDraft = "intro revised\nbody\n";
    const nextShadow = syncShadowWithCanonicalChange(previousDraft, nextDraft, previousDraft);

    expect(nextShadow).toBe(nextDraft);
    expect(diffDocuments(nextDraft, nextShadow)).toEqual([]);
  });

  it("keeps unrelated AI suggestions pending after a manual draft edit", () => {
    const previousDraft = "intro\nbody\nending\n";
    const shadowWithAi = "intro\nbody AI\nending\n";
    const nextDraft = "intro revised\nbody\nending\n";
    const rebasedShadow = syncShadowWithCanonicalChange(
      previousDraft,
      nextDraft,
      shadowWithAi
    );
    const hunks = diffDocuments(nextDraft, rebasedShadow);

    expect(rebasedShadow).toBe("intro revised\nbody AI\nending\n");
    expect(hunks).toHaveLength(1);
    expect(hunks[0]).toMatchObject({
      kind: "modified",
      segments: [
        { type: "removed", text: "body\n" },
        { type: "added", text: "body AI\n" }
      ]
    });
  });

  it("drops overlapping AI suggestions when the user edits the same region manually", () => {
    const previousDraft = "intro\nbody\nending\n";
    const shadowWithAi = "intro\nbody AI\nending\n";
    const nextDraft = "intro\nbody user\nending\n";
    const rebasedShadow = syncShadowWithCanonicalChange(
      previousDraft,
      nextDraft,
      shadowWithAi
    );

    expect(rebasedShadow).toBe(nextDraft);
    expect(diffDocuments(nextDraft, rebasedShadow)).toEqual([]);
  });

  it("approves an AI suggestion after a prior manual draft edit", () => {
    const previousDraft = "intro\nbody\nending\n";
    const shadowWithAi = "intro\nbody AI\nending\n";
    const nextDraft = "intro revised\nbody\nending\n";
    const rebasedShadow = syncShadowWithCanonicalChange(
      previousDraft,
      nextDraft,
      shadowWithAi
    );
    const hunks = diffDocuments(nextDraft, rebasedShadow);
    const approved = acceptReviewHunk(nextDraft, rebasedShadow, hunks[0]!.id, hunks);

    expect(approved.canonical).toBe("intro revised\nbody AI\nending\n");
    expect(approved.shadow).toBe("intro revised\nbody AI\nending\n");
    expect(approved.isComplete).toBe(true);
  });

  it("rejects an AI suggestion after a prior manual draft edit", () => {
    const previousDraft = "intro\nbody\nending\n";
    const shadowWithAi = "intro\nbody AI\nending\n";
    const nextDraft = "intro revised\nbody\nending\n";
    const rebasedShadow = syncShadowWithCanonicalChange(
      previousDraft,
      nextDraft,
      shadowWithAi
    );
    const hunks = diffDocuments(nextDraft, rebasedShadow);
    const rejected = rejectReviewHunk(nextDraft, rebasedShadow, hunks[0]!.id, hunks);

    expect(rejected.canonical).toBe(nextDraft);
    expect(rejected.shadow).toBe(nextDraft);
    expect(rejected.isComplete).toBe(true);
  });
});
