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
      return this.session
        ? {
            canonical: this.session.canonical,
            shadow: this.session.shadow
          }
        : null;
    }

    return {
      canonical: this.editorView.state.doc.toString(),
      shadow: getOriginalDoc(this.editorView.state).toString()
    };
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
        currentDoc.toString() === canonical
          ? undefined
          : {
              from: 0,
              to: currentDoc.length,
              insert: canonical
            };

      if (currentOriginal.toString() !== shadow) {
        effects.push(
          updateOriginalDoc.of({
            doc: buildDocument(shadow),
            changes: createReplaceChange(currentOriginal, shadow)
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

    this.editorView = new EditorView({
      parent: this.mergeHostEl,
      doc: this.session.canonical,
      extensions: this.buildEditorExtensions()
    });

    this.editorView.dom.classList.add("writing-copilot-merge-surface");

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
        original: this.session?.shadow ?? "",
        allowInlineDiffs: true,
        gutter: true,
        highlightChanges: true,
        mergeControls: (type, action) => this.renderInlineMergeControl(type, action)
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

  private renderInlineMergeControl(
    type: ReviewDecision,
    action: (event: MouseEvent) => void
  ): HTMLElement {
    const button = document.createElement("button");

    if (type === "reject") {
      button.textContent = "Approve";
      button.classList.add("is-approve");
    } else {
      button.textContent = "Reject";
      button.classList.add("is-reject");
    }

    button.onmousedown = action;
    return button;
  }

  private applySelectedChunk(decision: ReviewDecision): void {
    if (!this.editorView) {
      return;
    }

    const chunk = this.getCurrentChunks()[this.selectedChunkIndex];

    if (!chunk) {
      return;
    }

    // The unified editor shows the canonical Markdown note as the editable
    // document and the sibling `.shadow` file as the reference/original.
    // In this orientation, CM's rejectChunk applies the original suggestion
    // into the canonical note, while acceptChunk updates the reference doc
    // to match the canonical note.
    if (decision === "accept") {
      rejectChunk(this.editorView, chunk.fromB);
      return;
    }

    acceptChunk(this.editorView, chunk.fromB);
  }

  private renderToolbar(): void {
    if (!this.toolbarEl) {
      return;
    }

    this.toolbarEl.empty();
    this.summaryEl = this.toolbarEl.createDiv({
      cls: "writing-copilot-diff-mode-copy"
    });

    const projectLabel = this.session?.projectSlug ?? "Diff Review";
    const chunkCount = this.getCurrentChunks().length;
    const selectionLabel =
      chunkCount === 0
        ? "Aligned"
        : this.selectedChunkIndex >= 0
          ? `Change ${this.selectedChunkIndex + 1} / ${chunkCount}`
          : `${chunkCount} changes`;

    this.summaryEl.createEl("strong", {
      text: projectLabel
    });
    this.summaryEl.createEl("span", {
      text: selectionLabel
    });

    const actions = this.toolbarEl.createDiv({
      cls: "writing-copilot-diff-mode-actions"
    });

    const previousButton = actions.createEl("button", {
      text: "Previous"
    });
    previousButton.disabled = this.selectedChunkIndex <= 0;
    previousButton.addEventListener("click", () => {
      this.focusChunk(this.selectedChunkIndex - 1);
    });

    const nextButton = actions.createEl("button", {
      text: "Next"
    });
    nextButton.disabled =
      this.selectedChunkIndex < 0 ||
      this.selectedChunkIndex >= chunkCount - 1;
    nextButton.addEventListener("click", () => {
      this.focusChunk(this.selectedChunkIndex + 1);
    });

    const approveButton = actions.createEl("button", {
      text: "Approve"
    });
    approveButton.classList.add("is-approve");
    approveButton.disabled = this.selectedChunkIndex < 0;
    approveButton.addEventListener("click", () => {
      this.applySelectedChunk("accept");
    });

    const rejectButton = actions.createEl("button", {
      text: "Reject"
    });
    rejectButton.classList.add("is-reject");
    rejectButton.disabled = this.selectedChunkIndex < 0;
    rejectButton.addEventListener("click", () => {
      this.applySelectedChunk("reject");
    });

    const exitButton = actions.createEl("button", {
      text: "Exit"
    });
    exitButton.addEventListener("click", () => {
      void this.callbacks.onExitRequested();
    });
  }
}
