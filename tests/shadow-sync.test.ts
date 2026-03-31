import { syncShadowWithCanonicalChange } from "../src/lib/shadow-sync";

describe("shadow sync", () => {
  it("mirrors canonical changes directly when shadow is aligned", () => {
    expect(
      syncShadowWithCanonicalChange(
        "alpha\nbeta\n",
        "alpha\nbeta revised\n",
        "alpha\nbeta\n"
      )
    ).toBe("alpha\nbeta revised\n");
  });

  it("preserves non-overlapping shadow suggestions while mirroring canonical edits", () => {
    expect(
      syncShadowWithCanonicalChange(
        "alpha\nbeta\ngamma\n",
        "alpha\nbeta\ngamma revised\n",
        "alpha\nbeta AI\ngamma\n"
      )
    ).toBe("alpha\nbeta AI\ngamma revised\n");
  });

  it("lets canonical edits replace overlapping shadow suggestions", () => {
    expect(
      syncShadowWithCanonicalChange(
        "alpha\nbeta\ngamma\n",
        "alpha\nbeta user\ngamma\n",
        "alpha\nbeta AI\ngamma\n"
      )
    ).toBe("alpha\nbeta user\ngamma\n");
  });

  it("keeps unrelated shadow insertions when canonical changes elsewhere", () => {
    expect(
      syncShadowWithCanonicalChange(
        "alpha\nbeta\ngamma\n",
        "alpha revised\nbeta\ngamma\n",
        "alpha\nbeta\nAI paragraph\ngamma\n"
      )
    ).toBe("alpha revised\nbeta\nAI paragraph\ngamma\n");
  });
});
