import type { EditorAdapter } from './types';
import type { EditorAdapterRegistry } from './registry';

export interface ActiveEditor {
  adapter: EditorAdapter;
  element: HTMLElement;
}

export interface EditorDetectorOptions {
  document: Document;
  registry: EditorAdapterRegistry;
  onChange(active: ActiveEditor | null): void;
  debounceMs?: number;
}

export class EditorDetector {
  private active: ActiveEditor | null = null;
  private observer: MutationObserver | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private notifyOnRefresh = false;
  private readonly debounceMs: number;

  constructor(private readonly options: EditorDetectorOptions) {
    this.debounceMs = options.debounceMs ?? 60;
  }

  start(): void {
    const { document } = this.options;
    document.addEventListener('focusin', this.onFocusIn, true);
    document.addEventListener('focusout', this.onFocusOut, true);
    document.addEventListener('selectionchange', this.onSelectionChange, true);
    document.addEventListener('input', this.onInput, true);
    this.observer = new MutationObserver((records) => {
      if (
        this.active &&
        (!this.active.element.isConnected ||
          records.some((record) => [...record.removedNodes].includes(this.active!.element)))
      ) {
        this.setActive(null);
      }
      if (records.some((record) => record.addedNodes.length > 0)) this.scheduleRefresh();
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      const adapter = this.options.registry.findForElement(active);
      this.setActive(adapter ? { adapter, element: active } : null);
    }
  }

  stop(): void {
    const { document } = this.options;
    document.removeEventListener('focusin', this.onFocusIn, true);
    document.removeEventListener('focusout', this.onFocusOut, true);
    document.removeEventListener('selectionchange', this.onSelectionChange, true);
    document.removeEventListener('input', this.onInput, true);
    this.observer?.disconnect();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.notifyOnRefresh = false;
    this.setActive(null);
  }

  getActive(): ActiveEditor | null {
    return this.active;
  }

  private readonly onFocusIn = (event: FocusEvent): void => {
    if (
      event
        .composedPath()
        .some((item) => item instanceof HTMLElement && item.dataset.promptComposerUi === 'true')
    ) {
      return;
    }
    if (!(event.target instanceof Element)) return;
    const adapter = this.options.registry.findForElement(event.target);
    this.setActive(
      adapter && event.target instanceof HTMLElement ? { adapter, element: event.target } : null,
    );
  };

  private readonly onFocusOut = (): void => this.scheduleRefresh();

  private readonly onSelectionChange = (): void => this.scheduleRefresh();

  private readonly onInput = (event: Event): void => {
    if (this.active?.element === event.target) this.scheduleRefresh(true);
  };

  private readonly scheduleRefresh = (notifyCurrent = false): void => {
    this.notifyOnRefresh ||= notifyCurrent;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      const shouldNotifyCurrent = this.notifyOnRefresh;
      this.notifyOnRefresh = false;
      const active = this.options.document.activeElement;
      if (!(active instanceof HTMLElement)) return;
      if (active.shadowRoot?.querySelector('[data-prompt-composer-ui="true"]')) return;
      const adapter = this.options.registry.findForElement(active);
      this.setActive(adapter ? { adapter, element: active } : null, shouldNotifyCurrent);
    }, this.debounceMs);
  };

  private setActive(next: ActiveEditor | null, notifyCurrent = false): void {
    if (
      !notifyCurrent &&
      this.active?.element === next?.element &&
      this.active?.adapter.id === next?.adapter.id
    ) {
      return;
    }
    this.active = next;
    this.options.onChange(next);
  }
}
