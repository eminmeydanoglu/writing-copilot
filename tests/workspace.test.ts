import { diffDocuments } from "../src/lib/diff";
import { applyWorkspaceReview, readWorkspaceReviewState } from "../src/lib/workspace";
import type { WorkspaceProjectPaths } from "../src/lib/types";

function createPaths(root = "writings/example"): WorkspaceProjectPaths {
  return {
    root,
    canonicalPath: `${root}/example.md`,
    shadowPath: `${root}/example.shadow`,
    requestsPath: `${root}/requests`
  };
}

function createVault(initialFiles: Record<string, string>) {
  const files = new Map(Object.entries(initialFiles));
  const staleReads = new Map<string, string>();
  let failOnModifyPath: string | null = null;

  return {
    getAbstractFileByPath(path: string) {
      if (!files.has(path)) {
        return null;
      }

      return {
        path,
        extension: path.endsWith(".md") ? "md" : "json"
      };
    },
    async cachedRead(file: { path: string }) {
      const staleValue = staleReads.get(file.path);

      if (staleValue !== undefined) {
        return staleValue;
      }

      const value = files.get(file.path);

      if (value === undefined) {
        throw new Error(`Missing file ${file.path}`);
      }

      return value;
    },
    async read(file: { path: string }) {
      const value = files.get(file.path);

      if (value === undefined) {
        throw new Error(`Missing file ${file.path}`);
      }

      return value;
    },
    async modify(file: { path: string }, data: string) {
      if (failOnModifyPath === file.path) {
        throw new Error(`Write failed for ${file.path}`);
      }

      files.set(file.path, data);
    },
    setCachedRead(path: string, data: string) {
      staleReads.set(path, data);
    },
    failNextModify(path: string) {
      failOnModifyPath = path;
    },
    snapshot() {
      return Object.fromEntries(files);
    }
  };
}

describe("workspace review service", () => {
  it("reads the current canonical/shadow pair and computes hunks", async () => {
    const paths = createPaths();
    const vault = createVault({
      [paths.canonicalPath]: "alpha\nbeta\n",
      [paths.shadowPath]: "alpha revised\nbeta\n"
    });

    await expect(readWorkspaceReviewState(vault as never, paths)).resolves.toEqual({
      canonical: "alpha\nbeta\n",
      shadow: "alpha revised\nbeta\n",
      hunks: diffDocuments("alpha\nbeta\n", "alpha revised\nbeta\n")
    });
  });

  it("writes both canonical and shadow during a complete mixed review", async () => {
    const paths = createPaths();
    const vault = createVault({
      [paths.canonicalPath]: "alpha\nbeta\ngamma\ndelta\n",
      [paths.shadowPath]: "alpha\nbeta revised\ngamma\ndelta revised\n"
    });
    const hunks = diffDocuments(
      "alpha\nbeta\ngamma\ndelta\n",
      "alpha\nbeta revised\ngamma\ndelta revised\n"
    );

    const reviewed = await applyWorkspaceReview(
      vault as never,
      paths,
      {
        [hunks[0]!.id]: "accept",
        [hunks[1]!.id]: "reject"
      },
      hunks
    );

    expect(reviewed).toMatchObject({
      canonical: "alpha\nbeta revised\ngamma\ndelta\n",
      shadow: "alpha\nbeta revised\ngamma\ndelta\n",
      hunks: []
    });
    expect(vault.snapshot()).toMatchObject({
      [paths.canonicalPath]: "alpha\nbeta revised\ngamma\ndelta\n",
      [paths.shadowPath]: "alpha\nbeta revised\ngamma\ndelta\n"
    });
  });

  it("keeps undecided hunks pending after a partial review", async () => {
    const paths = createPaths();
    const vault = createVault({
      [paths.canonicalPath]: "alpha\nbeta\ngamma\ndelta\n",
      [paths.shadowPath]: "alpha\nbeta revised\ngamma\ndelta revised\n"
    });
    const hunks = diffDocuments(
      "alpha\nbeta\ngamma\ndelta\n",
      "alpha\nbeta revised\ngamma\ndelta revised\n"
    );

    const reviewed = await applyWorkspaceReview(
      vault as never,
      paths,
      {
        [hunks[0]!.id]: "accept"
      },
      hunks
    );

    expect(reviewed.canonical).toBe("alpha\nbeta revised\ngamma\ndelta\n");
    expect(reviewed.shadow).toBe("alpha\nbeta revised\ngamma\ndelta revised\n");
    expect(reviewed.hunks).toHaveLength(1);
    expect(vault.snapshot()).toMatchObject({
      [paths.canonicalPath]: "alpha\nbeta revised\ngamma\ndelta\n",
      [paths.shadowPath]: "alpha\nbeta revised\ngamma\ndelta revised\n"
    });
  });

  it("uses fresh reads for review writes instead of cached snapshots", async () => {
    const paths = createPaths();
    const vault = createVault({
      [paths.canonicalPath]: "current canonical\n",
      [paths.shadowPath]: "current shadow\n"
    });
    vault.setCachedRead(paths.canonicalPath, "stale canonical\n");
    vault.setCachedRead(paths.shadowPath, "stale shadow\n");

    const hunks = diffDocuments("current canonical\n", "current shadow\n");

    const reviewed = await applyWorkspaceReview(
      vault as never,
      paths,
      {
        [hunks[0]!.id]: "accept"
      },
      hunks
    );

    expect(reviewed).toMatchObject({
      canonical: "current shadow\n",
      shadow: "current shadow\n"
    });
    expect(vault.snapshot()).toMatchObject({
      [paths.canonicalPath]: "current shadow\n",
      [paths.shadowPath]: "current shadow\n"
    });
  });

  it("rolls back canonical if the second write fails", async () => {
    const paths = createPaths();
    const canonical = "alpha\nbeta\ngamma\ndelta\n";
    const shadow = "alpha\nbeta revised\ngamma\ndelta revised\n";
    const vault = createVault({
      [paths.canonicalPath]: canonical,
      [paths.shadowPath]: shadow
    });
    const hunks = diffDocuments(canonical, shadow);

    vault.failNextModify(paths.shadowPath);

    await expect(
      applyWorkspaceReview(
        vault as never,
        paths,
        {
          [hunks[0]!.id]: "accept",
          [hunks[1]!.id]: "reject"
        },
        hunks
      )
    ).rejects.toThrow(/could not persist review changes/i);

    expect(vault.snapshot()).toMatchObject({
      [paths.canonicalPath]: canonical,
      [paths.shadowPath]: shadow
    });
  });
});
