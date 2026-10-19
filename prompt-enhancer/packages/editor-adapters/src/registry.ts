import type { EditorAdapter } from './types';

export class EditorAdapterRegistry {
  readonly adapters: EditorAdapter[];

  constructor(adapters: EditorAdapter[]) {
    this.adapters = [...adapters].sort((left, right) => right.priority - left.priority);
  }

  findForElement(element: Element, location = window.location): EditorAdapter | null {
    return (
      this.adapters.find(
        (adapter) =>
          adapter.matchesPage(location, element.ownerDocument) &&
          adapter.isSupportedEditor(element),
      ) ?? null
    );
  }

  findActive(
    document: Document,
    location = window.location,
  ): { adapter: EditorAdapter; element: HTMLElement } | null {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      const adapter = this.findForElement(active, location);
      if (adapter) return { adapter, element: active };
    }
    for (const adapter of this.adapters) {
      if (!adapter.matchesPage(location, document)) continue;
      const element = adapter.findEditor(document);
      if (element) return { adapter, element };
    }
    return null;
  }
}
