import type { EditorPosition } from "obsidian";
import {
  MarkdownView,
  Notice,
  Plugin,
  TFile,
  type WorkspaceLeaf
} from "obsidian";
import { diffModeRuntime } from "./diff-mode/runtime";
import { diffModeEditorExtension } from "./editor/diff-mode-extension";
import {
  TOGGLE_DIFF_REVIEW_MODE_COMMAND_ID
} from "./constants";
import {
  ensureSelectedHunkId,
  findHunkIdAtLine,
  getHunkLineRange,
  getSelectedHunkIndex
} from "./lib/diff-mode";
import { diffDocuments } from "./lib/diff";
import { discoverWorkspaceProject } from "./lib/project";
import { applyReviewDecisionSet } from "./lib/review";
import type { DiffHunk, WorkspaceProject } from "./lib/types";

interface DiffModeSession {
  project: WorkspaceProject;
  canonicalLeaf: WorkspaceLeaf;
  shadowLeaf: WorkspaceLeaf;
  createdLeaf: WorkspaceLeaf;
  selectedHunkId: string | null;
  hunks: DiffHunk[];
}

type DiffModeRole = "canonical" | "shadow";

function toEditorLine(lineNumber: number): number {
  return Math.max(0, lineNumber - 1);
}

export default class WritingCopilotPlugin extends Plugin {
  private diffModeSession: DiffModeSession | null = null;
  private isApplyingDiffDecision = 0;
  private refreshTimer: number | null = null;

  async onload(): Promise<void> {
    this.registerEditorExtension(diffModeEditorExtension);
    diffModeRuntime.setSelectHunkCallback((filePath, lineNumber) => {
      this.selectHunkFromEditorLine(filePath, lineNumber);
    });

    this.addCommand({
      id: TOGGLE_DIFF_REVIEW_MODE_COMMAND_ID,
      name: "Toggle Diff Review Mode",
      callback: () => {
        void this.toggleDiffReviewMode();
      }
    });

    this.registerEvent(
      this.app.workspace.on("editor-change", (_editor, info) => {
        if (!this.diffModeSession || this.isApplyingDiffDecision > 0) {
          return;
        }

        const filePath = info.file?.path;

        if (!filePath || !this.isSessionFile(filePath)) {
          return;
        }

        this.scheduleRefreshDiffModeSession();
      })
    );

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.renderDiffModeBars();
      })
    );

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        if (!this.diffModeSession) {
          return;
        }

        if (!this.getSessionView("canonical") || !this.getSessionView("shadow")) {
          void this.deactivateDiffMode(false);
          return;
        }

        this.renderDiffModeBars();
      })
    );

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (!this.diffModeSession || this.isApplyingDiffDecision > 0) {
          return;
        }

        if (!this.isSessionFile(file.path)) {
          return;
        }

        this.scheduleRefreshDiffModeSession();
      })
    );
  }

  onunload(): void {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    diffModeRuntime.setSelectHunkCallback(null);
    diffModeRuntime.setSnapshot(null);
    void this.deactivateDiffMode(false);
  }

  private async toggleDiffReviewMode(): Promise<void> {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const activeLeaf = activeView?.leaf ?? null;
    const activeFile = activeView?.file ?? null;

    if (!activeView || !activeLeaf || !activeFile) {
      new Notice("Open draft.md or draft.shadow.md to enter diff review mode.");
      return;
    }

    if (
      this.diffModeSession &&
      (activeLeaf === this.diffModeSession.canonicalLeaf ||
        activeLeaf === this.diffModeSession.shadowLeaf)
    ) {
      await this.deactivateDiffMode(true);
      return;
    }

    const discovery = await discoverWorkspaceProject(this.app.vault, activeFile);

    if (discovery.status !== "ready") {
      new Notice(discovery.message);
      return;
    }

    if (
      activeFile.path !== discovery.project.paths.canonicalPath &&
      activeFile.path !== discovery.project.paths.shadowPath
    ) {
      new Notice("Open draft.md or draft.shadow.md before toggling diff review mode.");
      return;
    }

    if (this.diffModeSession) {
      await this.deactivateDiffMode(false);
    }

    await this.activateDiffMode(activeLeaf, discovery.project, activeFile);
  }

  private async activateDiffMode(
    activeLeaf: WorkspaceLeaf,
    project: WorkspaceProject,
    activeFile: TFile
  ): Promise<void> {
    const canonicalFile = this.app.vault.getFileByPath(project.paths.canonicalPath);
    const shadowFile = this.app.vault.getFileByPath(project.paths.shadowPath);

    if (!canonicalFile || !shadowFile) {
      new Notice("Could not open draft pair for diff review mode.");
      return;
    }

    let canonicalLeaf = activeLeaf;
    let shadowLeaf = activeLeaf;
    let createdLeaf: WorkspaceLeaf;

    if (activeFile.path === project.paths.shadowPath) {
      canonicalLeaf = this.app.workspace.createLeafBySplit(activeLeaf, "vertical", true);
      shadowLeaf = activeLeaf;
      createdLeaf = canonicalLeaf;
    } else {
      canonicalLeaf = activeLeaf;
      shadowLeaf = this.app.workspace.createLeafBySplit(activeLeaf, "vertical");
      createdLeaf = shadowLeaf;
    }

    await this.openMarkdownFileInLeaf(canonicalLeaf, canonicalFile, canonicalLeaf === activeLeaf);
    await this.openMarkdownFileInLeaf(shadowLeaf, shadowFile, shadowLeaf === activeLeaf);

    this.diffModeSession = {
      project,
      canonicalLeaf,
      shadowLeaf,
      createdLeaf,
      selectedHunkId: null,
      hunks: []
    };

    this.renderDiffModeBars();
    await this.refreshDiffModeSession(true);
  }

  private async deactivateDiffMode(closeCreatedLeaf: boolean): Promise<void> {
    const session = this.diffModeSession;

    if (!session) {
      diffModeRuntime.setSnapshot(null);
      return;
    }

    this.removeDiffModeBar(session.canonicalLeaf);
    this.removeDiffModeBar(session.shadowLeaf);
    diffModeRuntime.setSnapshot(null);

    const remainingLeaf =
      session.createdLeaf === session.canonicalLeaf
        ? session.shadowLeaf
        : session.canonicalLeaf;

    this.diffModeSession = null;

    if (closeCreatedLeaf) {
      this.app.workspace.setActiveLeaf(remainingLeaf, { focus: true });
      session.createdLeaf.detach();
    }
  }

  private async openMarkdownFileInLeaf(
    leaf: WorkspaceLeaf,
    file: TFile,
    active: boolean
  ): Promise<void> {
    await leaf.setViewState({
      type: "markdown",
      active,
      state: {
        file: file.path,
        mode: "source"
      }
    });
    await leaf.loadIfDeferred();
  }

  private scheduleRefreshDiffModeSession(): void {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      void this.refreshDiffModeSession(false);
    }, 80);
  }

  private async refreshDiffModeSession(shouldRevealSelection: boolean): Promise<void> {
    const session = this.diffModeSession;

    if (!session) {
      return;
    }

    const canonicalView = this.getSessionView("canonical");
    const shadowView = this.getSessionView("shadow");

    if (!canonicalView || !shadowView) {
      await this.deactivateDiffMode(false);
      return;
    }

    const canonical = canonicalView.editor.getValue();
    const shadow = shadowView.editor.getValue();
    const hunks = diffDocuments(canonical, shadow);

    session.hunks = hunks;
    session.selectedHunkId = ensureSelectedHunkId(hunks, session.selectedHunkId);

    diffModeRuntime.setSnapshot({
      projectRoot: session.project.root,
      canonicalPath: session.project.paths.canonicalPath,
      shadowPath: session.project.paths.shadowPath,
      hunks: session.hunks,
      selectedHunkId: session.selectedHunkId,
      isApplying: this.isApplyingDiffDecision > 0
    });

    this.renderDiffModeBars();

    if (shouldRevealSelection) {
      this.revealSelectedHunk();
    }
  }

  private renderDiffModeBars(): void {
    const session = this.diffModeSession;

    if (!session) {
      return;
    }

    this.renderDiffModeBar(session.canonicalLeaf, "canonical");
    this.renderDiffModeBar(session.shadowLeaf, "shadow");
  }

  private renderDiffModeBar(leaf: WorkspaceLeaf, role: DiffModeRole): void {
    const session = this.diffModeSession;
    const view = leaf.view;

    if (!session || !(view instanceof MarkdownView)) {
      this.removeDiffModeBar(leaf);
      return;
    }

    const existing = view.contentEl.querySelector<HTMLElement>(".writing-copilot-diff-mode-bar");
    existing?.remove();

    view.containerEl.addClass("writing-copilot-diff-mode-leaf", `is-${role}`);

    const bar = view.contentEl.createDiv();
    bar.classList.add("writing-copilot-diff-mode-bar");
    view.contentEl.prepend(bar);

    const label = role === "canonical" ? "Draft" : "Suggestion";
    const selectedIndex = getSelectedHunkIndex(session.hunks, session.selectedHunkId);
    const selectionLabel =
      session.hunks.length === 0
        ? "Aligned"
        : selectedIndex >= 0
          ? `Change ${selectedIndex + 1} / ${session.hunks.length}`
          : `${session.hunks.length} changes`;

    const leading = bar.createDiv();
    leading.classList.add("writing-copilot-diff-mode-copy");
    leading.createEl("strong", {
      text: `${label} · ${session.project.slug}`
    });
    leading.createEl("span", {
      text: selectionLabel
    });

    const actions = bar.createDiv();
    actions.classList.add("writing-copilot-diff-mode-actions");

    const previousButton = actions.createEl("button", {
      text: "Previous"
    });
    previousButton.disabled =
      this.isApplyingDiffDecision > 0 || session.hunks.length <= 1 || selectedIndex <= 0;
    previousButton.addEventListener("click", () => {
      this.selectRelativeHunk(-1);
    });

    const nextButton = actions.createEl("button", {
      text: "Next"
    });
    nextButton.disabled =
      this.isApplyingDiffDecision > 0 ||
      session.hunks.length <= 1 ||
      selectedIndex < 0 ||
      selectedIndex >= session.hunks.length - 1;
    nextButton.addEventListener("click", () => {
      this.selectRelativeHunk(1);
    });

    const approveButton = actions.createEl("button", {
      text: "Approve"
    });
    approveButton.classList.add("is-approve");
    approveButton.disabled =
      this.isApplyingDiffDecision > 0 || !session.selectedHunkId || session.hunks.length === 0;
    approveButton.addEventListener("click", () => {
      void this.applyDecisionToSelectedHunk("accept");
    });

    const rejectButton = actions.createEl("button", {
      text: "Reject"
    });
    rejectButton.classList.add("is-reject");
    rejectButton.disabled =
      this.isApplyingDiffDecision > 0 || !session.selectedHunkId || session.hunks.length === 0;
    rejectButton.addEventListener("click", () => {
      void this.applyDecisionToSelectedHunk("reject");
    });

    const exitButton = actions.createEl("button", {
      text: "Exit"
    });
    exitButton.addEventListener("click", () => {
      void this.deactivateDiffMode(true);
    });
  }

  private removeDiffModeBar(leaf: WorkspaceLeaf): void {
    const view = leaf.view;

    if (!(view instanceof MarkdownView)) {
      return;
    }

    view.contentEl.querySelector<HTMLElement>(".writing-copilot-diff-mode-bar")?.remove();
    view.containerEl.removeClass("writing-copilot-diff-mode-leaf", "is-canonical", "is-shadow");
  }

  private getSessionView(role: DiffModeRole): MarkdownView | null {
    const session = this.diffModeSession;

    if (!session) {
      return null;
    }

    const leaf = role === "canonical" ? session.canonicalLeaf : session.shadowLeaf;

    return leaf.view instanceof MarkdownView ? leaf.view : null;
  }

  private isSessionFile(filePath: string): boolean {
    const session = this.diffModeSession;

    return !!session &&
      (filePath === session.project.paths.canonicalPath ||
        filePath === session.project.paths.shadowPath);
  }

  private selectRelativeHunk(direction: -1 | 1): void {
    const session = this.diffModeSession;

    if (!session) {
      return;
    }

    const currentIndex = getSelectedHunkIndex(session.hunks, session.selectedHunkId);
    const nextHunk = session.hunks[currentIndex + direction];

    if (!nextHunk) {
      return;
    }

    session.selectedHunkId = nextHunk.id;
    diffModeRuntime.setSnapshot({
      projectRoot: session.project.root,
      canonicalPath: session.project.paths.canonicalPath,
      shadowPath: session.project.paths.shadowPath,
      hunks: session.hunks,
      selectedHunkId: session.selectedHunkId,
      isApplying: this.isApplyingDiffDecision > 0
    });
    this.renderDiffModeBars();
    this.revealSelectedHunk();
  }

  private selectHunkFromEditorLine(filePath: string, lineNumber: number): void {
    const session = this.diffModeSession;

    if (!session) {
      return;
    }

    const role: DiffModeRole =
      filePath === session.project.paths.canonicalPath ? "canonical" : "shadow";
    const hunkId = findHunkIdAtLine(session.hunks, role, lineNumber);

    if (!hunkId || hunkId === session.selectedHunkId) {
      return;
    }

    session.selectedHunkId = hunkId;
    diffModeRuntime.setSnapshot({
      projectRoot: session.project.root,
      canonicalPath: session.project.paths.canonicalPath,
      shadowPath: session.project.paths.shadowPath,
      hunks: session.hunks,
      selectedHunkId: session.selectedHunkId,
      isApplying: this.isApplyingDiffDecision > 0
    });
    this.renderDiffModeBars();
  }

  private revealSelectedHunk(): void {
    const session = this.diffModeSession;

    if (!session || !session.selectedHunkId) {
      return;
    }

    const hunk = session.hunks.find((candidate) => candidate.id === session.selectedHunkId);

    if (!hunk) {
      return;
    }

    this.scrollViewToHunk("canonical", hunk);
    this.scrollViewToHunk("shadow", hunk);
  }

  private scrollViewToHunk(role: DiffModeRole, hunk: DiffHunk): void {
    const view = this.getSessionView(role);
    const range = getHunkLineRange(hunk, role);

    if (!view || !range) {
      return;
    }

    const from: EditorPosition = {
      line: toEditorLine(range.startLine),
      ch: 0
    };
    const to: EditorPosition = {
      line: toEditorLine(range.endLine),
      ch: 0
    };

    view.editor.scrollIntoView({ from, to }, true);
  }

  private async applyDecisionToSelectedHunk(
    decision: "accept" | "reject"
  ): Promise<void> {
    const session = this.diffModeSession;
    const canonicalView = this.getSessionView("canonical");
    const shadowView = this.getSessionView("shadow");

    if (!session || !canonicalView || !shadowView) {
      return;
    }

    const canonical = canonicalView.editor.getValue();
    const shadow = shadowView.editor.getValue();
    const currentHunks = diffDocuments(canonical, shadow);
    const selectedHunkId = ensureSelectedHunkId(currentHunks, session.selectedHunkId);

    if (!selectedHunkId) {
      await this.refreshDiffModeSession(false);
      return;
    }

    this.isApplyingDiffDecision += 1;

    try {
      const reviewed = applyReviewDecisionSet(
        canonical,
        shadow,
        {
          [selectedHunkId]: decision
        },
        currentHunks
      );

      canonicalView.editor.setValue(reviewed.canonical);
      shadowView.editor.setValue(reviewed.shadow);
      await Promise.all([canonicalView.save(false), shadowView.save(false)]);
    } catch (error) {
      new Notice(
        error instanceof Error ? error.message : "Could not apply review decision."
      );
    } finally {
      this.isApplyingDiffDecision -= 1;
      await this.refreshDiffModeSession(true);
    }
  }
}
