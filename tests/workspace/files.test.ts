import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import {
  ensureWorkspace,
  restoreVersion,
  reviewWorkspace,
  syncShadow,
  writeCanonical,
  writeShadow
} from "@/src/lib/workspace/files";
import type { WorkspacePaths } from "@/src/lib/workspace/types";

function makePaths(dir: string): WorkspacePaths {
  return {
    root: dir,
    canonicalPath: path.join(dir, "draft.md"),
    shadowPath: path.join(dir, "draft.shadow.md"),
    versionsPath: path.join(dir, "versions.json")
  };
}

describe("workspace files", () => {
  it("creates canonical and shadow files with the same initial content", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "wc-files-"));
    const paths = makePaths(dir);

    await ensureWorkspace(paths, "# Draft\n\nStart here.\n");

    await expect(readFile(paths.canonicalPath, "utf8")).resolves.toBe(
      "# Draft\n\nStart here.\n"
    );
    await expect(readFile(paths.shadowPath, "utf8")).resolves.toBe(
      "# Draft\n\nStart here.\n"
    );
    const versions = JSON.parse(
      await readFile(paths.versionsPath, "utf8")
    ) as Array<{ label: string }>;
    expect(versions).toHaveLength(1);
    expect(versions[0]?.label).toBe("Initial draft");
  });

  it("does not promote shadow content into canonical when canonical is missing", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "wc-shadow-safety-"));
    const paths = makePaths(dir);

    await writeFile(paths.shadowPath, "agent-only shadow edit\n", "utf8");

    await ensureWorkspace(paths, "seed canonical\n");

    await expect(readFile(paths.canonicalPath, "utf8")).resolves.toBe(
      "seed canonical\n"
    );
    await expect(readFile(paths.shadowPath, "utf8")).resolves.toBe(
      "agent-only shadow edit\n"
    );
  });

  it("syncs shadow back to canonical after canonical changes", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "wc-sync-"));
    const paths = makePaths(dir);

    await ensureWorkspace(paths, "alpha\nbeta\n");
    await writeCanonical(paths, "alpha\nbeta revised\n");

    await syncShadow(paths);

    await expect(readFile(paths.shadowPath, "utf8")).resolves.toBe(
      "alpha\nbeta revised\n"
    );
  });

  it("applies reviewed hunks and stores the merged canonical document as a version", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "wc-review-"));
    const paths = makePaths(dir);

    await ensureWorkspace(paths, "alpha\nbeta\ngamma\ndelta\n");
    await writeShadow(paths, "alpha\nbeta revised\ngamma\ndelta revised\n");

    const firstPass = await reviewWorkspace(paths, {});
    expect(firstPass.hunks).toHaveLength(2);

    const merged = await reviewWorkspace(paths, {
      [firstPass.hunks[0].id]: "accept",
      [firstPass.hunks[1].id]: "reject"
    });

    expect(merged.canonical).toBe("alpha\nbeta revised\ngamma\ndelta\n");
    expect(merged.shadow).toBe("alpha\nbeta revised\ngamma\ndelta\n");
    expect(merged.hunks).toHaveLength(0);
    expect(merged.versions[0]?.source).toBe("review");
  });

  it("keeps undecided hunks pending after a partial review", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "wc-partial-"));
    const paths = makePaths(dir);

    await ensureWorkspace(paths, "alpha\nbeta\ngamma\ndelta\n");
    await writeShadow(paths, "alpha\nbeta revised\ngamma\ndelta revised\n");

    const initial = await reviewWorkspace(paths, {});
    const partial = await reviewWorkspace(paths, {
      [initial.hunks[0].id]: "accept"
    });

    expect(partial.canonical).toBe("alpha\nbeta revised\ngamma\ndelta\n");
    expect(partial.shadow).toBe("alpha\nbeta revised\ngamma\ndelta revised\n");
    expect(partial.hunks).toHaveLength(1);
  });

  it("restores an earlier version and syncs shadow to it", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "wc-restore-"));
    const paths = makePaths(dir);

    await ensureWorkspace(paths, "first draft\n");
    await writeCanonical(paths, "second draft\n", {
      source: "manual",
      label: "Saved canonical draft"
    });

    const versions = JSON.parse(
      await readFile(paths.versionsPath, "utf8")
    ) as Array<{ id: string }>;
    const restored = await restoreVersion(paths, versions[1]!.id);

    expect(restored.canonical).toBe("first draft\n");
    expect(restored.shadow).toBe("first draft\n");
    expect(restored.versions[0]?.source).toBe("restore");
  });
});
