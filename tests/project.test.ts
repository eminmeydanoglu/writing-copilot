import {
  discoverWorkspaceProject,
  findProjectRootFromPath,
  getWorkspaceProjectPaths,
  validateProjectStructure
} from "../src/lib/project";
import type { ProjectEntryType } from "../src/lib/types";

describe("project discovery helpers", () => {
  it("resolves a project root from any file inside writings/<slug>", () => {
    expect(
      findProjectRootFromPath(
        "writings/duygusuzlasma-dunyasizlasma/resources/source-material.md"
      )
    ).toBe("writings/duygusuzlasma-dunyasizlasma");
    expect(
      findProjectRootFromPath(
        "writings/duygusuzlasma-dunyasizlasma/requests/request-1.json"
      )
    ).toBe("writings/duygusuzlasma-dunyasizlasma");
  });

  it("rejects files outside a writing project", () => {
    expect(findProjectRootFromPath("README.md")).toBeNull();
    expect(findProjectRootFromPath("writings/styles/lyrical-analytic.md")).toBeNull();
    expect(findProjectRootFromPath(null)).toBeNull();
  });

  it("validates the required project file contract", () => {
    const paths = getWorkspaceProjectPaths("writings/example");
    const entries = new Map<string, ProjectEntryType>([
      [paths.canonicalPath, "file"],
      [paths.shadowPath, "file"],
      [paths.projectPath, "file"],
      [paths.resourcesPath, "folder"],
      [paths.requestsPath, "folder"]
    ]);

    expect(
      validateProjectStructure(paths, (path) => entries.get(path) ?? "missing")
    ).toEqual([]);
  });

  it("reports missing and mistyped required paths clearly", () => {
    const paths = getWorkspaceProjectPaths("writings/example");
    const entries = new Map<string, ProjectEntryType>([
      [paths.canonicalPath, "file"],
      [paths.shadowPath, "file"],
      [paths.projectPath, "file"],
      [paths.resourcesPath, "file"]
    ]);

    expect(
      validateProjectStructure(paths, (path) => entries.get(path) ?? "missing")
    ).toEqual([
      {
        code: "invalid-path-type",
        path: "writings/example/resources",
        expected: "folder",
        actual: "file"
      },
      {
        code: "missing-required-path",
        path: "writings/example/requests",
        expected: "folder",
        actual: "missing"
      }
    ]);
  });

  it("turns malformed request metadata into a clear invalid project state", async () => {
    const paths = getWorkspaceProjectPaths("writings/example");
    const vault = {
      getAbstractFileByPath(path: string) {
        if (path === paths.requestsPath) {
          return {
            children: [
              {
                path: `${paths.requestsPath}/broken.json`,
                basename: "broken",
                extension: "json"
              }
            ]
          };
        }

        if (
          path === paths.canonicalPath ||
          path === paths.shadowPath ||
          path === paths.projectPath
        ) {
          return {
            path,
            extension: "md",
            stat: {}
          };
        }

        if (path === paths.resourcesPath) {
          return {
            children: []
          };
        }

        return null;
      },
      async cachedRead(): Promise<string> {
        return "{not-valid-json";
      }
    };

    await expect(
      discoverWorkspaceProject(vault as never, {
        path: paths.canonicalPath
      } as never)
    ).resolves.toMatchObject({
      status: "invalid",
      projectRoot: "writings/example",
      message: expect.stringMatching(/could not load request metadata/i)
    });
  });

  it("loads the current review state for a valid project", async () => {
    const paths = getWorkspaceProjectPaths("writings/example");
    const vault = {
      getAbstractFileByPath(path: string) {
        if (path === paths.requestsPath) {
          return {
            children: [
              {
                path: `${paths.requestsPath}/req-1.json`,
                basename: "req-1",
                extension: "json"
              }
            ]
          };
        }

        if (
          path === paths.canonicalPath ||
          path === paths.shadowPath ||
          path === paths.projectPath
        ) {
          return {
            path,
            extension: "md",
            stat: {}
          };
        }

        if (path === paths.resourcesPath) {
          return {
            children: []
          };
        }

        return null;
      },
      async cachedRead(file: { path: string }): Promise<string> {
        if (file.path === paths.canonicalPath) {
          return "alpha\nbeta\n";
        }

        if (file.path === paths.shadowPath) {
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
        path: paths.canonicalPath
      } as never)
    ).resolves.toMatchObject({
      status: "ready",
      project: {
        root: "writings/example",
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
