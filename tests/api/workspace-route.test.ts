import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";
import { GET as getWorkspace, PUT as putWorkspace } from "@/app/api/workspace/route";
import { POST as reviewWorkspaceRoute } from "@/app/api/workspace/review/route";
import { getWorkspacePaths } from "@/src/lib/workspace/config";
import { ensureWorkspace, writeCanonical, writeShadow } from "@/src/lib/workspace/files";

describe("workspace api", () => {
  it("seeds a fresh workspace with the default document", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "wc-default-api-"));
    process.env.WRITING_COPILOT_WORKSPACE_DIR = dir;

    const response = await getWorkspace();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.canonical).toContain("Untitled Draft");
    expect(payload.shadow).toContain("Untitled Draft");
    expect(payload.versions[0]?.label).toBe("Initial draft");
  });

  it("returns the current workspace state", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "wc-api-"));
    process.env.WRITING_COPILOT_WORKSPACE_DIR = dir;

    const paths = getWorkspacePaths();
    await ensureWorkspace(paths, "# Draft\n\nHello world.\n");

    const response = await getWorkspace();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.canonical).toContain("Hello world.");
    expect(payload.hunks).toHaveLength(0);
    expect(payload.versions).toHaveLength(1);
  });

  it("applies review decisions and returns the updated state", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "wc-review-api-"));
    process.env.WRITING_COPILOT_WORKSPACE_DIR = dir;

    const paths = getWorkspacePaths();
    await ensureWorkspace(paths, "alpha\nbeta\n");
    await writeShadow(paths, "alpha\nbeta revised\n");

    const before = await getWorkspace();
    const beforePayload = await before.json();

    const response = await reviewWorkspaceRoute(
      new Request("http://localhost/api/workspace/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          decisions: {
            [beforePayload.hunks[0].id]: "accept"
          }
        })
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.canonical).toBe("alpha\nbeta revised\n");
    expect(payload.shadow).toBe("alpha\nbeta revised\n");
    expect(payload.hunks).toHaveLength(0);
    expect(payload.versions[0]?.source).toBe("review");
    await expect(readFile(paths.canonicalPath, "utf8")).resolves.toBe(
      "alpha\nbeta revised\n"
    );
    await expect(readFile(paths.shadowPath, "utf8")).resolves.toBe(
      "alpha\nbeta revised\n"
    );
  });

  it("preserves pending review suggestions during canonical autosave", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "wc-put-review-api-"));
    process.env.WRITING_COPILOT_WORKSPACE_DIR = dir;

    const paths = getWorkspacePaths();
    await ensureWorkspace(paths, "alpha\nbeta\n");
    await writeShadow(paths, "alpha\nbeta revised\n");

    const response = await putWorkspace(
      new Request("http://localhost/api/workspace", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          canonical: "alpha\nbeta updated locally\n"
        })
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.canonical).toBe("alpha\nbeta updated locally\n");
    expect(payload.shadow).toBe("alpha\nbeta revised\n");
    expect(payload.hunks).toHaveLength(1);
    await expect(readFile(paths.canonicalPath, "utf8")).resolves.toBe(
      "alpha\nbeta updated locally\n"
    );
    await expect(readFile(paths.shadowPath, "utf8")).resolves.toBe(
      "alpha\nbeta revised\n"
    );
  });

  it("restores a saved version through the restore api", async () => {
    const { POST: restoreVersionRoute } = await import(
      "@/app/api/workspace/versions/[versionId]/restore/route"
    );
    const dir = await mkdtemp(path.join(os.tmpdir(), "wc-restore-api-"));
    process.env.WRITING_COPILOT_WORKSPACE_DIR = dir;

    const paths = getWorkspacePaths();
    await ensureWorkspace(paths, "first draft\n");
    await writeCanonical(paths, "second draft\n", {
      source: "manual",
      label: "Saved canonical draft"
    });

    const versions = JSON.parse(
      await readFile(paths.versionsPath, "utf8")
    ) as Array<{ id: string }>;

    const response = await restoreVersionRoute(new Request("http://localhost"), {
      params: Promise.resolve({
        versionId: versions[1]!.id
      })
    });

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.canonical).toBe("first draft\n");
    expect(payload.shadow).toBe("first draft\n");
    expect(payload.versions[0]?.source).toBe("restore");
  });
});
