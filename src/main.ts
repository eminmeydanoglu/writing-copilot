import {
  MarkdownView,
  Notice,
  Plugin,
  TFile,
  type Editor,
  type MarkdownFileInfo,
  type WorkspaceLeaf
} from "obsidian";
import {
  DIFF_MERGE_VIEW_TYPE,
  TOGGLE_DIFF_REVIEW_MODE_COMMAND_ID
} from "./constants";
import {
  DiffMergeView,
  type DiffMergeViewSession,
  type DiffMergeViewState
} from "./diff-mode/merge-view";
import {
  discoverWorkspaceProject,
  getWorkspaceProjectPaths
} from "./lib/project";
import { syncShadowWithCanonicalChange } from "./lib/shadow-sync";
import type { WorkspaceProject, WorkspaceProjectPaths } from "./lib/types";

interface DiffModeSession {
  canonicalFile: TFile;
  canonicalText: string;
  entryPath: string;
  isPersisting: number;
  leaf: WorkspaceLeaf;
  pendingReloadTimer: number | null;
  pendingSaveTimer: number | null;
  project: WorkspaceProject;
  selectedChunkIndex: number;
  shadowFile: TFile;
  shadowText: string;
  syncGeneration: number;
}

interface ShadowSyncState {
  canonicalFile: TFile;
  canonicalText: string;
  isPersisting: number;
  pendingCanonicalText: string | null;
  pendingSyncTimer: number | null;
  shadowFile: TFile;
  shadowText: string;
}

export default class WritingCopilotPlugin extends Plugin {
  private diffModeSession: DiffModeSession | null = null;
  private readonly shadowSyncStates = new Map<string, ShadowSyncState>();

  async onload(): Promise<void> {
    this.registerView(
      DIFF_MERGE_VIEW_TYPE,
      (leaf) =>
        new DiffMergeView(leaf, {
          onDocumentsChange: (canonical, shadow) => {
            this.handleMergeDocumentsChange(canonical, shadow);
          },
          onExitRequested: () => this.deactivateDiffMode(true),
          onSelectedChunkChange: (chunkIndex) => {
            if (this.diffModeSession) {
              this.diffModeSession.selectedChunkIndex = chunkIndex;
            }
          }
        })
    );

    this.addCommand({
      id: TOGGLE_DIFF_REVIEW_MODE_COMMAND_ID,
      name: "Toggle Diff Review Mode",
      callback: () => {
        void this.toggleDiffReviewMode();
      }
    });

    this.registerEvent(
      this.app.workspace.on("editor-change", (editor, info) => {
        void this.handleEditorChange(editor, info);
      })
    );

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile) {
          void this.handleVaultModify(file);
        }
      })
    );
  }

  onunload(): void {
    for (const state of this.shadowSyncStates.values()) {
      if (state.pendingSyncTimer !== null) {
        window.clearTimeout(state.pendingSyncTimer);
      }
    }

    void this.deactivateDiffMode(false);
    this.app.workspace.detachLeavesOfType(DIFF_MERGE_VIEW_TYPE);
  }

  private async toggleDiffReviewMode(): Promise<void> {
    const session = this.diffModeSession;
    const activeLeaf = this.app.workspace.activeLeaf ?? null;

    if (session && activeLeaf === session.leaf) {
      await this.deactivateDiffMode(true);
      return;
    }

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const activeFile = activeView?.file ?? null;
    const targetLeaf = activeView?.leaf ?? null;

    if (!activeView || !activeFile || !targetLeaf) {
      new Notice("Open a Markdown note with a sibling .shadow file to enter diff review mode.");
      return;
    }

    const discovery = await discoverWorkspaceProject(this.app.vault, activeFile);

    if (discovery.status !== "ready") {
      new Notice(discovery.message);
      return;
    }

    const { project } = discovery;

    if (session) {
      await this.deactivateDiffMode(true);
    }

    await this.activateDiffMode(targetLeaf, project, activeFile.path);
  }

  private async activateDiffMode(
    leaf: WorkspaceLeaf,
    project: WorkspaceProject,
    entryPath: string
  ): Promise<void> {
    const canonicalFile = this.app.vault.getFileByPath(project.paths.canonicalPath);
    const shadowFile = this.app.vault.getFileByPath(project.paths.shadowPath);

    if (!canonicalFile || !shadowFile) {
      new Notice("Could not open this note and its sibling .shadow file.");
      return;
    }

    const canonicalText = await this.app.vault.cachedRead(canonicalFile);
    const shadowText = await this.app.vault.cachedRead(shadowFile);

    this.updateShadowSyncSnapshot(canonicalFile, shadowFile, canonicalText, shadowText);

    this.diffModeSession = {
      canonicalFile,
      canonicalText,
      entryPath,
      isPersisting: 0,
      leaf,
      pendingReloadTimer: null,
      pendingSaveTimer: null,
      project,
      selectedChunkIndex: 0,
      shadowFile,
      shadowText,
      syncGeneration: 0
    };

    const viewState: DiffMergeViewState = {
      canonicalPath: canonicalFile.path,
      entryPath,
      projectRoot: project.root,
      shadowPath: shadowFile.path
    };

    await leaf.setViewState({
      type: DIFF_MERGE_VIEW_TYPE,
      active: true,
      state: viewState
    });
    await leaf.loadIfDeferred();

    const view = this.getDiffMergeView();

    if (!view) {
      this.diffModeSession = null;
      new Notice("Could not initialize diff review mode.");
      return;
    }

    const sessionData: DiffMergeViewSession = {
      canonical: canonicalText,
      projectSlug: project.slug,
      selectedChunkIndex: 0,
      shadow: shadowText
    };

    view.setSession(viewState, sessionData);
    await this.app.workspace.revealLeaf(leaf);
  }

  private async deactivateDiffMode(restoreMarkdown: boolean): Promise<void> {
    const session = this.diffModeSession;

    if (!session) {
      return;
    }

    if (session.pendingReloadTimer !== null) {
      window.clearTimeout(session.pendingReloadTimer);
      session.pendingReloadTimer = null;
    }

    await this.flushPendingSave(session);

    this.diffModeSession = null;

    if (!restoreMarkdown) {
      return;
    }

    const targetFile =
      this.app.vault.getFileByPath(session.entryPath) ?? session.canonicalFile;

    await session.leaf.setViewState({
      type: "markdown",
      active: true,
      state: {
        file: targetFile.path,
        mode: "source"
      }
    });
    await session.leaf.loadIfDeferred();
    await this.app.workspace.revealLeaf(session.leaf);
  }

  private getDiffMergeView(): DiffMergeView | null {
    const session = this.diffModeSession;

    if (!session || !(session.leaf.view instanceof DiffMergeView)) {
      return null;
    }

    return session.leaf.view;
  }

  private async handleEditorChange(
    editor: Editor,
    info: MarkdownView | MarkdownFileInfo
  ): Promise<void> {
    const file = info.file;

    if (!file) {
      return;
    }

    const state = await this.ensureShadowSyncStateForCanonicalPath(file.path);

    if (!state) {
      return;
    }

    const nextCanonical = editor.getValue();

    if (nextCanonical === state.pendingCanonicalText) {
      return;
    }

    if (state.pendingCanonicalText === null && nextCanonical === state.canonicalText) {
      return;
    }

    state.pendingCanonicalText = nextCanonical;
    this.scheduleShadowSync(state);
  }

  private async handleVaultModify(file: TFile): Promise<void> {
    const session = this.diffModeSession;

    if (session && this.isSessionFile(file.path)) {
      if (session.isPersisting > 0) {
        return;
      }

      this.scheduleReloadFromVault();
    }

    const existingState = this.getShadowSyncStateForPath(file.path);

    if (!existingState) {
      return;
    }

    if (file.path === existingState.shadowFile.path) {
      if (existingState.isPersisting > 0) {
        return;
      }

      existingState.shadowText = await this.app.vault.read(existingState.shadowFile);
      return;
    }

    const canonicalFromDisk = await this.app.vault.read(existingState.canonicalFile);

    if (canonicalFromDisk === existingState.canonicalText) {
      return;
    }

    if (canonicalFromDisk === existingState.pendingCanonicalText) {
      return;
    }

    existingState.pendingCanonicalText = canonicalFromDisk;
    this.scheduleShadowSync(existingState);
  }

  private isSessionFile(filePath: string): boolean {
    const session = this.diffModeSession;

    return !!session &&
      (filePath === session.canonicalFile.path || filePath === session.shadowFile.path);
  }

  private handleMergeDocumentsChange(canonical: string, shadow: string): void {
    const session = this.diffModeSession;

    if (!session) {
      return;
    }

    session.canonicalText = canonical;
    session.shadowText = shadow;
    this.updateShadowSyncSnapshot(
      session.canonicalFile,
      session.shadowFile,
      canonical,
      shadow
    );
    this.scheduleSessionSave();
  }

  private scheduleSessionSave(): void {
    const session = this.diffModeSession;

    if (!session) {
      return;
    }

    if (session.pendingSaveTimer !== null) {
      window.clearTimeout(session.pendingSaveTimer);
    }

    session.pendingSaveTimer = window.setTimeout(() => {
      session.pendingSaveTimer = null;
      void this.persistSessionDocuments(session);
    }, 150);
  }

  private async flushPendingSave(session: DiffModeSession): Promise<void> {
    if (session.pendingSaveTimer !== null) {
      window.clearTimeout(session.pendingSaveTimer);
      session.pendingSaveTimer = null;
    }

    await this.persistSessionDocuments(session);
  }

  private async persistSessionDocuments(session: DiffModeSession): Promise<void> {
    if (this.diffModeSession !== session) {
      return;
    }

    const view = this.getDiffMergeView();
    const documents = view?.getDocuments();
    const canonical = documents?.canonical ?? session.canonicalText;
    const shadow = documents?.shadow ?? session.shadowText;

    const generation = session.syncGeneration + 1;
    session.syncGeneration = generation;
    session.isPersisting += 1;

    try {
      await Promise.all([
        this.app.vault.modify(session.canonicalFile, canonical),
        this.app.vault.modify(session.shadowFile, shadow)
      ]);

      if (this.diffModeSession !== session || session.syncGeneration !== generation) {
        return;
      }

      session.canonicalText = canonical;
      session.shadowText = shadow;
      this.updateShadowSyncSnapshot(
        session.canonicalFile,
        session.shadowFile,
        canonical,
        shadow
      );
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "Could not save diff review edits.");
    } finally {
      session.isPersisting = Math.max(0, session.isPersisting - 1);
    }
  }

  private scheduleReloadFromVault(): void {
    const session = this.diffModeSession;

    if (!session) {
      return;
    }

    if (session.pendingReloadTimer !== null) {
      window.clearTimeout(session.pendingReloadTimer);
    }

    session.pendingReloadTimer = window.setTimeout(() => {
      session.pendingReloadTimer = null;
      void this.reloadSessionFromVault();
    }, 80);
  }

  private async reloadSessionFromVault(): Promise<void> {
    const session = this.diffModeSession;

    if (!session) {
      return;
    }

    const [canonical, shadow] = await Promise.all([
      this.app.vault.cachedRead(session.canonicalFile),
      this.app.vault.cachedRead(session.shadowFile)
    ]);

    if (
      canonical === session.canonicalText &&
      shadow === session.shadowText
    ) {
      return;
    }

    session.canonicalText = canonical;
    session.shadowText = shadow;
    this.updateShadowSyncSnapshot(
      session.canonicalFile,
      session.shadowFile,
      canonical,
      shadow
    );
    const view = this.getDiffMergeView();

    view?.replaceDocuments(canonical, shadow);
  }

  private getShadowSyncStateForPath(filePath: string): ShadowSyncState | null {
    for (const state of this.shadowSyncStates.values()) {
      if (filePath === state.canonicalFile.path || filePath === state.shadowFile.path) {
        return state;
      }
    }

    return null;
  }

  private async ensureShadowSyncStateForCanonicalPath(
    filePath: string
  ): Promise<ShadowSyncState | null> {
    const paths = getWorkspaceProjectPaths(filePath);

    if (!paths || paths.canonicalPath !== filePath) {
      return null;
    }

    return this.ensureShadowSyncState(paths);
  }

  private async ensureShadowSyncState(
    paths: WorkspaceProjectPaths
  ): Promise<ShadowSyncState | null> {
    const existingState = this.shadowSyncStates.get(paths.canonicalPath);

    if (existingState) {
      return existingState;
    }

    const canonicalFile = this.app.vault.getFileByPath(paths.canonicalPath);
    const shadowFile = this.app.vault.getFileByPath(paths.shadowPath);

    if (!canonicalFile || !shadowFile) {
      return null;
    }

    const [canonicalText, shadowText] = await Promise.all([
      this.app.vault.read(canonicalFile),
      this.app.vault.read(shadowFile)
    ]);

    return this.updateShadowSyncSnapshot(
      canonicalFile,
      shadowFile,
      canonicalText,
      shadowText
    );
  }

  private updateShadowSyncSnapshot(
    canonicalFile: TFile,
    shadowFile: TFile,
    canonicalText: string,
    shadowText: string
  ): ShadowSyncState {
    const existingState = this.shadowSyncStates.get(canonicalFile.path);

    if (existingState) {
      existingState.canonicalFile = canonicalFile;
      existingState.shadowFile = shadowFile;
      existingState.canonicalText = canonicalText;
      existingState.shadowText = shadowText;

      if (existingState.pendingCanonicalText === canonicalText) {
        existingState.pendingCanonicalText = null;
      }

      return existingState;
    }

    const nextState: ShadowSyncState = {
      canonicalFile,
      canonicalText,
      isPersisting: 0,
      pendingCanonicalText: null,
      pendingSyncTimer: null,
      shadowFile,
      shadowText
    };

    this.shadowSyncStates.set(canonicalFile.path, nextState);
    return nextState;
  }

  private scheduleShadowSync(state: ShadowSyncState): void {
    if (state.pendingSyncTimer !== null) {
      window.clearTimeout(state.pendingSyncTimer);
    }

    state.pendingSyncTimer = window.setTimeout(() => {
      state.pendingSyncTimer = null;
      void this.persistShadowSyncState(state);
    }, 120);
  }

  private async persistShadowSyncState(state: ShadowSyncState): Promise<void> {
    const nextCanonical = state.pendingCanonicalText;

    if (nextCanonical === null || nextCanonical === state.canonicalText) {
      return;
    }

    const latestShadow = await this.app.vault.read(state.shadowFile);

    if (latestShadow !== state.shadowText) {
      state.shadowText = latestShadow;
    }

    const nextShadow = syncShadowWithCanonicalChange(
      state.canonicalText,
      nextCanonical,
      state.shadowText
    );

    state.isPersisting += 1;

    try {
      if (nextShadow !== latestShadow) {
        await this.app.vault.modify(state.shadowFile, nextShadow);
      }

      state.canonicalText = nextCanonical;
      state.shadowText = nextShadow;

      if (state.pendingCanonicalText === nextCanonical) {
        state.pendingCanonicalText = null;
      }
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "Could not sync the sibling .shadow file.");
    } finally {
      state.isPersisting = Math.max(0, state.isPersisting - 1);
    }

    if (
      state.pendingCanonicalText !== null &&
      state.pendingCanonicalText !== state.canonicalText
    ) {
      this.scheduleShadowSync(state);
    }
  }
}
