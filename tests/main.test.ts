import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MarkdownView as MockMarkdownView,
  Notice,
  notices,
  Plugin as MockPlugin,
  resetObsidianMockState
} from "obsidian";
import { diffDocuments } from "../src/lib/diff";

const discoverWorkspaceProjectMock = vi.fn();

class MockLeaf {
  readonly setViewState = vi.fn(async (state: { state: { file: string } }) => {
    const nextPath = state.state.file;
    const nextValue = this.app.vault.readFile(nextPath);
    this.view.setFile(nextPath, nextValue);
  });
  readonly loadIfDeferred = vi.fn(async () => {});
  readonly detach = vi.fn();
  view: MockMarkdownView;

  constructor(
    readonly id: string,
    private readonly app: MockApp,
    filePath: string,
    initialValue: string
  ) {
    this.view = new MockMarkdownView(this, filePath, initialValue);
    this.view.save = vi.fn(async () => {});
    this.view.editor.scrollIntoView = vi.fn();
  }
}

class MockVault {
  constructor(private readonly files: Map<string, string>) {}

  getFileByPath(path: string): { path: string } | null {
    return this.files.has(path) ? { path } : null;
  }

  on(): { event: string } {
    return { event: "modify" };
  }

  readFile(path: string): string {
    const value = this.files.get(path);

    if (value === undefined) {
      throw new Error(`Missing file ${path}`);
    }

    return value;
  }
}

class MockWorkspace {
  activeLeaf: MockLeaf;

  constructor(private readonly app: MockApp, activeLeaf: MockLeaf) {
    this.activeLeaf = activeLeaf;
  }

  getActiveViewOfType(type: typeof MockMarkdownView): MockMarkdownView | null {
    return this.activeLeaf.view instanceof type ? this.activeLeaf.view : null;
  }

  createLeafBySplit(): MockLeaf {
    return new MockLeaf(
      "leaf-1",
      this.app,
      this.activeLeaf.view.file?.path ?? "",
      this.activeLeaf.view.editor.getValue()
    );
  }

  setActiveLeaf(): void {}

  on(): { event: string } {
    return { event: "workspace" };
  }
}

class MockApp {
  readonly vault: MockVault;
  readonly workspace: MockWorkspace;

  constructor(files: Record<string, string>, activePath: string) {
    this.vault = new MockVault(new Map(Object.entries(files)));
    const activeLeaf = new MockLeaf("leaf-0", this, activePath, files[activePath] ?? "");
    this.workspace = new MockWorkspace(this, activeLeaf);
  }
}

vi.mock("../src/editor/diff-mode-extension", () => ({
  diffModeEditorExtension: {}
}));

vi.mock("../src/lib/project", () => ({
  discoverWorkspaceProject: discoverWorkspaceProjectMock
}));

const projectPaths = {
  root: "writings/example",
  canonicalPath: "writings/example/draft.md",
  shadowPath: "writings/example/draft.shadow.md",
  projectPath: "writings/example/project.md",
  resourcesPath: "writings/example/resources",
  requestsPath: "writings/example/requests"
};

const project = {
  slug: "example",
  root: projectPaths.root,
  activeFilePath: projectPaths.canonicalPath,
  paths: projectPaths,
  review: {
    canonical: "alpha\nbeta\n",
    shadow: "alpha\nbeta revised\n",
    hunks: diffDocuments("alpha\nbeta\n", "alpha\nbeta revised\n")
  },
  requests: {
    records: [],
    byId: {},
    latest: null
  }
};

async function loadPlugin(app: MockApp) {
  const { default: WritingCopilotPlugin } = await import("../src/main");
  const plugin = new WritingCopilotPlugin(app as never, {} as never) as MockPlugin & {
    onload: () => Promise<void>;
  };
  await plugin.onload();
  return plugin;
}

describe("writing copilot plugin save failure handling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetObsidianMockState();
    discoverWorkspaceProjectMock.mockReset();
    (globalThis as typeof globalThis & { window: typeof globalThis }).window = globalThis;
  });

  it("restores editor text when persisting a review decision fails", async () => {
    const app = new MockApp(
      {
        [projectPaths.canonicalPath]: "alpha\nbeta\n",
        [projectPaths.shadowPath]: "alpha\nbeta revised\n"
      },
      projectPaths.canonicalPath
    );
    discoverWorkspaceProjectMock.mockResolvedValue({
      status: "ready",
      message: "Ready",
      project
    });
    const plugin = await loadPlugin(app);

    await (plugin as never).toggleDiffReviewMode();

    const session = (plugin as never).diffModeSession;
    const canonicalView = session.canonicalLeaf.view as MockMarkdownView & {
      save: ReturnType<typeof vi.fn>;
    };
    const shadowView = session.shadowLeaf.view as MockMarkdownView & {
      save: ReturnType<typeof vi.fn>;
    };
    shadowView.save.mockRejectedValueOnce(new Error("shadow save failed"));

    await (plugin as never).applyDecisionToSelectedHunk("accept");

    expect(canonicalView.editor.getValue()).toBe("alpha\nbeta\n");
    expect(shadowView.editor.getValue()).toBe("alpha\nbeta revised\n");
    expect(notices).toContain("shadow save failed");
    expect(Notice).toBeDefined();
  });
});
