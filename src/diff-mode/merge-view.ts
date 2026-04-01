import {
  acceptChunk,
  getChunks,
  getOriginalDoc,
  rejectChunk,
  unifiedMergeView,
  updateOriginalDoc,
  type Chunk
} from "@codemirror/merge";
import {
  ChangeSet,
  Compartment,
  EditorSelection,
  EditorState,
  RangeSetBuilder,
  type Extension,
  type Text
} from "@codemirror/state";
import { Decoration, EditorView, type ViewUpdate } from "@codemirror/view";
import { ItemView, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import { DIFF_MERGE_VIEW_TYPE } from "../constants";
import {
  getUnifiedMergeDocPair,
  getUnifiedMergeEditorContent,
  readUnifiedMergeEditorContent
} from "./merge-view-documents";

type ReviewDecision = "accept" | "reject";

export interface DiffMergeViewState extends Record<string, unknown> {
  canonicalPath: string;
  shadowPath: string;
  entryPath: string;
  projectRoot: string;
}

export interface DiffMergeViewSession {
  canonical: string;
  shadow: string;
  projectSlug: string;
  selectedChunkIndex: number;
}

interface DiffMergeViewCallbacks {
  onDocumentsChange: (canonical: string, shadow: string) => void;
  onExitRequested: () => Promise<void>;
  onSelectedChunkChange: (chunkIndex: number) => void;
}

function buildDocument(text: string): Text {
  return EditorState.create({ doc: text }).doc;
}

function createReplaceChange(doc: Text, next: string): ChangeSet {
  return ChangeSet.of(
    {
      from: 0,
      to: doc.length,
      insert: next
    },
    doc.length
  );
}

function createLineDecorationSet(doc: Text, chunk: Chunk | null) {
  if (!chunk) {
    return Decoration.none;
  }

  const from = chunk.fromB;
  const to = chunk.toB;
  const end = chunk.endB;
  const classes = "writing-copilot-merge-selected-line";

  if (from === to) {
    const line = doc.lineAt(Math.min(from, doc.length));
    return Decoration.set([
      Decoration.line({ class: classes }).range(line.from)
    ]);
  }

  const startLine = doc.lineAt(Math.min(from, doc.length)).number;
  const endLine = doc.lineAt(Math.min(end, doc.length)).number;
  const builder = new RangeSetBuilder<Decoration>();

  for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
    builder.add(
      doc.line(lineNumber).from,
      doc.line(lineNumber).from,
      Decoration.line({ class: classes })
    );
  }

  return builder.finish();
}

function chunkContainsPosition(chunk: Chunk, position: number): boolean {
  if (chunk.fromB === chunk.toB) {
    return position === chunk.fromB;
  }

  return position >= chunk.fromB && position <= chunk.endB;
}

export class DiffMergeView extends ItemView {
  private readonly callbacks: DiffMergeViewCallbacks;
  private viewState: DiffMergeViewState | null = null;
  private session: DiffMergeViewSession | null = null;
  private editorView: EditorView | null = null;
  private mergeHostEl: HTMLElement | null = null;
  private toolbarEl: HTMLElement | null = null;
  private summaryEl: HTMLElement | null = null;
  private selectedChunkIndex = -1;
  private isProgrammaticDocumentUpdate = 0;
  private selectionCompartment: Compartment | null = null;

  constructor(leaf: WorkspaceLeaf, callbacks: DiffMergeViewCallbacks) {
    super(leaf);
    this.callbacks = callbacks;
    this.navigation = true;
    this.icon = "git-compare";
  }

  getViewType(): string {
    return DIFF_MERGE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.session
      ? `Diff Review · ${this.session.projectSlug}`
      : "Diff Review";
  }

  getState(): Record<string, unknown> {
    return this.viewState ?? {};
  }

  async setState(state: unknown, _result: ViewStateResult): Promise<void> {
    if (!state || typeof state !== "object") {
      this.viewState = null;
      this.renderShell();
      return;
    }

    const candidate = state as Partial<DiffMergeViewState>;

    if (
      typeof candidate.canonicalPath !== "string" ||
      typeof candidate.shadowPath !== "string" ||
      typeof candidate.entryPath !== "string" ||
      typeof candidate.projectRoot !== "string"
    ) {
      this.viewState = null;
      this.renderShell();
      return;
    }

    this.viewState = {
      canonicalPath: candidate.canonicalPath,
      shadowPath: candidate.shadowPath,
      entryPath: candidate.entryPath,
      projectRoot: candidate.projectRoot
    };

    this.renderShell();
  }

  async onOpen(): Promise<void> {
    this.renderShell();
  }

  async onClose(): Promise<void> {
    this.destroyEditor();
  }

  setSession(state: DiffMergeViewState, session: DiffMergeViewSession): void {
    this.viewState = state;
    this.session = session;
    this.selectedChunkIndex = session.selectedChunkIndex;
    this.renderShell();
    this.mountUnifiedEditor();
  }

  getDocuments(): { canonical: string; shadow: string } | null {
    if (!this.editorView) {
      return this.session ? getUnifiedMergeDocPair(this.session) : null;
    }

    return readUnifiedMergeEditorContent(this.editorView.state);
  }

  replaceDocuments(canonical: string, shadow: string): void {
    if (!this.editorView) {
      if (this.session) {
        this.session = {
          ...this.session,
          canonical,
          shadow
        };
      }
      this.renderToolbar();
      return;
    }

    this.isProgrammaticDocumentUpdate += 1;

    try {
      const currentDoc = this.editorView.state.doc;
      const currentOriginal = getOriginalDoc(this.editorView.state);
      const effects = [];
      const changes =
        currentDoc.toString() === shadow
          ? undefined
          : {
              from: 0,
              to: currentDoc.length,
              insert: shadow
            };

      if (currentOriginal.toString() !== canonical) {
        effects.push(
          updateOriginalDoc.of({
            doc: buildDocument(canonical),
            changes: createReplaceChange(currentOriginal, canonical)
          })
        );
      }

      if (changes || effects.length > 0) {
        this.editorView.dispatch({
          changes,
          effects
        });
      }

      if (this.session) {
        this.session = {
          ...this.session,
          canonical,
          shadow
        };
      }
    } finally {
      this.isProgrammaticDocumentUpdate -= 1;
    }

    this.syncSelectedChunkFromView(this.editorView);
  }

  private renderShell(): void {
    this.destroyEditor();
    this.contentEl.empty();
    this.contentEl.addClass("writing-copilot-merge-view");

    const shell = this.contentEl.createDiv({
      cls: "writing-copilot-merge-shell"
    });

    this.toolbarEl = shell.createDiv({
      cls: "writing-copilot-diff-mode-bar"
    });
    this.mergeHostEl = shell.createDiv({
      cls: "writing-copilot-merge-host"
    });

    this.renderToolbar();
  }

  private mountUnifiedEditor(): void {
    if (!this.session || !this.mergeHostEl) {
      return;
    }

    this.destroyEditor();
    this.selectionCompartment = new Compartment();
    const editorContent = getUnifiedMergeEditorContent(this.session);

    this.editorView = new EditorView({
      parent: this.mergeHostEl,
      doc: editorContent.doc,
      extensions: this.buildEditorExtensions()
    });

    this.editorView.dom.classList.add(
      "writing-copilot-merge-surface",
      "markdown-source-view",
      "mod-cm6"
    );

    const chunks = this.getCurrentChunks();

    if (chunks.length > 0) {
      const initialIndex = Math.max(0, Math.min(this.selectedChunkIndex, chunks.length - 1));
      this.focusChunk(initialIndex);
    } else {
      this.syncSelectedChunkFromView(this.editorView);
    }
  }

  private destroyEditor(): void {
    this.editorView?.destroy();
    this.editorView = null;
    this.selectionCompartment = null;
    this.mergeHostEl?.empty();
  }

  private buildEditorExtensions(): Extension[] {
    if (!this.selectionCompartment) {
      throw new Error("Selection compartment must be initialized before mounting merge view.");
    }

    return [
      EditorView.lineWrapping,
      unifiedMergeView({
        original: getUnifiedMergeEditorContent(this.session).original,
        allowInlineDiffs: true,
        gutter: true,
        highlightChanges: true,
        syntaxHighlightDeletions: false,
        mergeControls: false,
      }),
      EditorView.updateListener.of((update) => {
        this.handleEditorUpdate(update);
      }),
      this.selectionCompartment.of(EditorView.decorations.of(Decoration.none))
    ];
  }

  private handleEditorUpdate(update: ViewUpdate): void {
    if (update.selectionSet || update.docChanged || update.viewportChanged) {
      this.syncSelectedChunkFromView(update.view);
    }

    if (this.isProgrammaticDocumentUpdate > 0) {
      return;
    }

    const documents = this.getDocuments();

    if (!documents || !this.session) {
      return;
    }

    if (
      documents.canonical === this.session.canonical &&
      documents.shadow === this.session.shadow
    ) {
      return;
    }

    this.session = {
      ...this.session,
      canonical: documents.canonical,
      shadow: documents.shadow
    };

    this.callbacks.onDocumentsChange(documents.canonical, documents.shadow);
  }

  private getCurrentChunks(): readonly Chunk[] {
    return this.editorView ? (getChunks(this.editorView.state)?.chunks ?? []) : [];
  }

  private getNearestChunkIndex(position: number): number {
    const chunks = this.getCurrentChunks();

    if (chunks.length === 0) {
      return -1;
    }

    const exactIndex = chunks.findIndex((chunk) => chunkContainsPosition(chunk, position));

    if (exactIndex >= 0) {
      return exactIndex;
    }

    const nextIndex = chunks.findIndex((chunk) => chunk.fromB >= position);

    if (nextIndex >= 0) {
      return nextIndex;
    }

    return chunks.length - 1;
  }

  private setSelectedChunkIndex(index: number): void {
    const chunkCount = this.getCurrentChunks().length;
    const nextIndex = index >= 0 && index < chunkCount ? index : -1;

    if (nextIndex === this.selectedChunkIndex) {
      this.updateSelectedChunkDecorations();
      this.renderToolbar();
      return;
    }

    this.selectedChunkIndex = nextIndex;
    this.updateSelectedChunkDecorations();
    this.renderToolbar();
    this.callbacks.onSelectedChunkChange(nextIndex);
  }

  private syncSelectedChunkFromView(view: EditorView): void {
    this.setSelectedChunkIndex(this.getNearestChunkIndex(view.state.selection.main.head));
  }

  private focusChunk(index: number): void {
    const chunks = this.getCurrentChunks();

    if (chunks.length === 0 || !this.editorView) {
      this.setSelectedChunkIndex(-1);
      return;
    }

    const boundedIndex = Math.max(0, Math.min(index, chunks.length - 1));
    const chunk = chunks[boundedIndex];

    if (!chunk) {
      this.setSelectedChunkIndex(-1);
      return;
    }

    this.editorView.dispatch({
      selection: EditorSelection.cursor(chunk.fromB),
      scrollIntoView: true
    });
  }

  private updateSelectedChunkDecorations(): void {
    if (!this.editorView || !this.selectionCompartment) {
      return;
    }

    const selectedChunk =
      this.selectedChunkIndex >= 0
        ? this.getCurrentChunks()[this.selectedChunkIndex] ?? null
        : null;

    this.editorView.dispatch({
      effects: this.selectionCompartment.reconfigure(
        EditorView.decorations.of(
          createLineDecorationSet(this.editorView.state.doc, selectedChunk)
        )
      )
    });
  }

  private applySelectedChunk(decision: ReviewDecision): void {
    if (!this.editorView) {
      return;
    }

    const chunk = this.getCurrentChunks()[this.selectedChunkIndex];

    if (!chunk) {
      return;
    }

    // The unified editor shows the sibling `.shadow` file as the editable
    // document and the canonical Markdown note as the reference/original.
    // In this orientation, CM's acceptChunk approves the shadow suggestion
    // into the canonical note, while rejectChunk restores shadow to canonical.
    if (decision === "accept") {
      acceptChunk(this.editorView, chunk.fromB);
      return;
    }

    rejectChunk(this.editorView, chunk.fromB);
  }

  private renderToolbar(): void {
    if (!this.toolbarEl) {
      return;
    }

    this.toolbarEl.empty();
    const projectLabel = this.session?.projectSlug ?? "Diff Review";
    const chunkCount = this.getCurrentChunks().length;
    const selectionLabel =
      chunkCount === 0
        ? "Aligned"
        : this.selectedChunkIndex >= 0
          ? `Change ${this.selectedChunkIndex + 1} of ${chunkCount}`
          : `${chunkCount} pending`;
    const metaLabel =
      chunkCount === 0
        ? "Canonical and shadow are aligned."
        : chunkCount === 1
          ? "1 pending change in this review."
          : `${chunkCount} pending changes in this review.`;

    this.summaryEl = this.toolbarEl.createDiv({
      cls: "writing-copilot-diff-mode-heading"
    });

    const titleRow = this.summaryEl.createDiv({
      cls: "writing-copilot-diff-mode-title-row"
    });

    titleRow.createDiv({
      cls: "writing-copilot-diff-mode-title",
      text: `${projectLabel}.md`
    });
    titleRow.createDiv({
      cls: "writing-copilot-diff-mode-status",
      text: selectionLabel
    });

    this.summaryEl.createDiv({
      cls: "writing-copilot-diff-mode-meta",
      text: metaLabel
    });

    const actions = this.toolbarEl.createDiv({
      cls: "writing-copilot-diff-mode-actions"
    });

    const navigationActions = actions.createDiv({
      cls: "writing-copilot-diff-mode-action-group"
    });
    const reviewActions = actions.createDiv({
      cls: "writing-copilot-diff-mode-action-group"
    });
    const exitActions = actions.createDiv({
      cls: "writing-copilot-diff-mode-action-group"
    });

    const previousButton = navigationActions.createEl("button", {
      text: "Previous"
    });
    previousButton.disabled = this.selectedChunkIndex <= 0;
    previousButton.addEventListener("click", () => {
      this.focusChunk(this.selectedChunkIndex - 1);
    });

    const nextButton = navigationActions.createEl("button", {
      text: "Next"
    });
    nextButton.disabled =
      this.selectedChunkIndex < 0 ||
      this.selectedChunkIndex >= chunkCount - 1;
    nextButton.addEventListener("click", () => {
      this.focusChunk(this.selectedChunkIndex + 1);
    });

    const approveButton = reviewActions.createEl("button", {
      text: "Approve"
    });
    approveButton.classList.add("is-approve", "is-primary-action");
    approveButton.disabled = this.selectedChunkIndex < 0;
    approveButton.addEventListener("click", () => {
      this.applySelectedChunk("accept");
    });

    const rejectButton = reviewActions.createEl("button", {
      text: "Reject"
    });
    rejectButton.classList.add("is-reject", "is-danger-action");
    rejectButton.disabled = this.selectedChunkIndex < 0;
    rejectButton.addEventListener("click", () => {
      this.applySelectedChunk("reject");
    });

    const exitButton = exitActions.createEl("button", {
      text: "Exit"
    });
    exitButton.classList.add("is-subtle-action");
    exitButton.addEventListener("click", () => {
      void this.callbacks.onExitRequested();
    });
  }
}
