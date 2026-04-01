export const notices: string[] = [];

class FakeClassList {
  private readonly values = new Set<string>();

  add(...classes: string[]): void {
    for (const value of classes) {
      this.values.add(value);
    }
  }

  remove(...classes: string[]): void {
    for (const value of classes) {
      this.values.delete(value);
    }
  }

  contains(value: string): boolean {
    return this.values.has(value);
  }
}

class FakeElement {
  readonly classList = new FakeClassList();
  readonly children: FakeElement[] = [];
  textContent = "";
  disabled = false;

  constructor(readonly tag: string) {}

  addClass(...classes: string[]): void {
    this.classList.add(...classes);
  }

  removeClass(...classes: string[]): void {
    this.classList.remove(...classes);
  }

  createDiv(): FakeElement {
    const child = new FakeElement("div");
    this.children.push(child);
    return child;
  }

  createEl(tag: string, options?: { text?: string }): FakeElement {
    const child = new FakeElement(tag);
    child.textContent = options?.text ?? "";
    this.children.push(child);
    return child;
  }

  prepend(child: FakeElement): void {
    this.children.unshift(child);
  }

  querySelector<T>(selector: string): T | null {
    if (!selector.startsWith(".")) {
      return null;
    }

    const className = selector.slice(1);
    return (this.findByClass(className) as T | null) ?? null;
  }

  addEventListener(): void {}

  remove(): void {
    this.classList.add("__removed__");
  }

  private findByClass(className: string): FakeElement | null {
    for (const child of this.children) {
      if (child.classList.contains(className)) {
        return child;
      }

      const nested = child.findByClass(className);

      if (nested) {
        return nested;
      }
    }

    return null;
  }
}

export class Plugin {
  app: unknown;
  commands: Array<{ id: string; callback: () => void }> = [];

  constructor(app: unknown) {
    this.app = app;
  }

  addCommand(command: { id: string; callback: () => void }): void {
    this.commands.push(command);
  }

  registerEvent(eventRef: unknown): unknown {
    return eventRef;
  }

  registerEditorExtension(): void {}
}

export class Notice {
  constructor(message: string) {
    notices.push(message);
  }
}

export class MarkdownView {
  leaf: unknown;
  file: { path: string } | null;
  readonly contentEl = new FakeElement("div");
  readonly containerEl = new FakeElement("div");
  readonly editor: {
    getValue: () => string;
    setValue: (value: string) => void;
    scrollIntoView: (range: unknown, center: boolean) => void;
  };
  save: (clear?: boolean) => Promise<void> = async () => {};
  private value: string;

  constructor(leaf: unknown, filePath: string, initialValue: string) {
    this.leaf = leaf;
    this.file = { path: filePath };
    this.value = initialValue;
    this.editor = {
      getValue: () => this.value,
      setValue: (value: string) => {
        this.value = value;
      },
      scrollIntoView: () => {}
    };
  }

  setFile(filePath: string, value: string): void {
    this.file = { path: filePath };
    this.value = value;
  }
}

export class TFile {}

export function resetObsidianMockState(): void {
  notices.length = 0;
}
