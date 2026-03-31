import {
  discoverWorkspaceProject,
  findProjectRootFromPath,
  getWorkspaceProjectPaths,
  validateProjectStructure
} from "../src/lib/project";
import type { ProjectEntryType } from "../src/lib/types";

describe("workspace pair discovery", () => {
  it("resolves a workspace root from a markdown note", () => {
    expect(findProjectRootFromPath("notes/essay.md")).toBe("notes");
    expect(findProjectRootFromPath("essay.md")).toBe("");
  });

  it("rejects non-markdown files", () => {
    expect(findProjectRootFromPath("README")).toBeNull();
    expect(findProjectRootFromPath("notes/essay.shadow")).toBeNull();
    expect(findProjectRootFromPath(null)).toBeNull();
  });

  it("derives sibling paths from the active markdown note", () => {
    expect(getWorkspaceProjectPaths("notes/example.md")).toEqual({
      root: "notes",
      canonicalPath: "notes/example.md",
      shadowPath: "notes/example.shadow.md",
      requestsPath: "notes/requests"
    });
    expect(getWorkspaceProjectPaths("example.md")).toEqual({
      root: "",
      canonicalPath: "example.md",
      shadowPath: "example.shadow.md",
      requestsPath: "requests"
    });
  });

  it("resolves the pair correctly when the shadow markdown note is active", () => {
    expect(getWorkspaceProjectPaths("notes/example.shadow.md")).toEqual({
      root: "notes",
      canonicalPath: "notes/example.md",
      shadowPath: "notes/example.shadow.md",
      requestsPath: "notes/requests"
    });
  });

  it("validates only the canonical/shadow pair", () => {
    const paths = getWorkspaceProjectPaths("notes/example.md");

    expect(paths).not.toBeNull();

    const entries = new Map<string, ProjectEntryType>([
      [paths!.canonicalPath, "file"],
      [paths!.shadowPath, "file"]
    ]);

    expect(
      validateProjectStructure(paths!, (path) => entries.get(path) ?? "missing")
    ).toEqual([]);
  });

  it("reports a missing sibling shadow file clearly", () => {
    const paths = getWorkspaceProjectPaths("notes/example.md");

    expect(paths).not.toBeNull();

    const entries = new Map<string, ProjectEntryType>([
      [paths!.canonicalPath, "file"]
    ]);

    expect(
      validateProjectStructure(paths!, (path) => entries.get(path) ?? "missing")
    ).toEqual([
      {
        code: "missing-required-path",
        path: "notes/example.shadow.md",
        expected: "file",
        actual: "missing"
      }
    ]);
  });

  it("treats malformed optional request metadata as non-blocking", async () => {
    const paths = getWorkspaceProjectPaths("notes/example.md");

    expect(paths).not.toBeNull();

    const vault = {
      getAbstractFileByPath(path: string) {
        if (path === paths!.requestsPath) {
          return {
            children: [
              {
                path: `${paths!.requestsPath}/broken.json`,
                basename: "broken",
                extension: "json"
              }
            ]
          };
        }

        if (path === paths!.canonicalPath || path === paths!.shadowPath) {
          return {
            path,
            extension: path.endsWith(".md") ? "md" : "",
            stat: {}
          };
        }

        return null;
      },
      async cachedRead(file: { path: string }): Promise<string> {
        if (file.path === paths!.canonicalPath) {
          return "alpha\nbeta\n";
        }

        if (file.path === paths!.shadowPath) {
          return "alpha revised\nbeta\n";
        }

        return "{not-valid-json";
      }
    };

    await expect(
      discoverWorkspaceProject(vault as never, {
        path: paths!.canonicalPath
      } as never)
    ).resolves.toMatchObject({
      status: "ready",
      project: {
        root: "notes",
        requests: {
          records: []
        }
      }
    });
  });

  it("loads the current review state for a valid note pair", async () => {
    const paths = getWorkspaceProjectPaths("notes/example.md");

    expect(paths).not.toBeNull();

    const vault = {
      getAbstractFileByPath(path: string) {
        if (path === paths!.requestsPath) {
          return {
            children: [
              {
                path: `${paths!.requestsPath}/req-1.json`,
                basename: "req-1",
                extension: "json"
              }
            ]
          };
        }

        if (path === paths!.canonicalPath || path === paths!.shadowPath) {
          return {
            path,
            extension: path.endsWith(".md") ? "md" : "",
            stat: {}
          };
        }

        return null;
      },
      async cachedRead(file: { path: string }): Promise<string> {
        if (file.path === paths!.canonicalPath) {
          return "alpha\nbeta\n";
        }

        if (file.path === paths!.shadowPath) {
          return "alpha revised\nbeta\n";
        }

        return JSON.stringify({
          id: "req-1",
          agent: "Writer",
          title: "Tighten opening",
          task: "Revise the first line",
          createdAt: "2026-03-28T12:00:00.000Z",
          status: "completed",
          shadowRevision: "shadow-1"
        });
      }
    };

    await expect(
      discoverWorkspaceProject(vault as never, {
        path: paths!.canonicalPath
      } as never)
    ).resolves.toMatchObject({
      status: "ready",
      project: {
        root: "notes",
        review: {
          hunks: [expect.objectContaining({ kind: "modified" })]
        },
        requests: {
          records: [expect.objectContaining({ id: "req-1" })]
        }
      }
    });
  });
});
