import { describe, expect, it, vi } from "vitest";
import { notices, resetObsidianMockState } from "obsidian";

describe("writing copilot plugin save failure handling", () => {
  it("keeps session state intact and surfaces a notice when persisting review edits fails", async () => {
    resetObsidianMockState();

    const { default: WritingCopilotPlugin } = await import("../src/main");
    const modify = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("shadow save failed"));
    const plugin = new WritingCopilotPlugin(
      {
        vault: {
          modify
        }
      } as never,
      {} as never
    ) as never;

    const session = {
      canonicalFile: { path: "writings/example/draft.md" },
      canonicalText: "alpha\nbeta\n",
      entryPath: "writings/example/draft.md",
      isPersisting: 0,
      leaf: { view: null },
      pendingReloadTimer: null,
      pendingSaveTimer: null,
      project: {
        slug: "example",
        root: "writings/example",
        paths: {
          canonicalPath: "writings/example/draft.md",
          shadowPath: "writings/example/draft.shadow.md"
        }
      },
      selectedChunkIndex: 0,
      shadowFile: { path: "writings/example/draft.shadow.md" },
      shadowText: "alpha\nbeta revised\n",
      syncGeneration: 0
    };

    plugin.diffModeSession = session;
    plugin.getDiffMergeView = vi.fn(() => ({
      getDocuments: () => ({
        canonical: "alpha\nbeta merged\n",
        shadow: "alpha\nbeta revised\n"
      })
    }));
    plugin.updateShadowSyncSnapshot = vi.fn();

    await plugin.persistSessionDocuments(session);

    expect(modify).toHaveBeenNthCalledWith(1, session.canonicalFile, "alpha\nbeta merged\n");
    expect(modify).toHaveBeenNthCalledWith(2, session.shadowFile, "alpha\nbeta revised\n");
    expect(session.canonicalText).toBe("alpha\nbeta\n");
    expect(session.shadowText).toBe("alpha\nbeta revised\n");
    expect(session.isPersisting).toBe(0);
    expect(notices).toContain("shadow save failed");
    expect(plugin.updateShadowSyncSnapshot).not.toHaveBeenCalled();
  });
});
