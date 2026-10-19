import { ContentEditableEditorAdapter } from './contenteditable';
import { TextareaEditorAdapter } from './textarea';
import { SITE_EDITOR_SELECTORS, SITE_HOSTNAMES, type SupportedSite } from './site-selectors';
import type { EditorAdapter, EditorInsertMode, EditorSelection } from './types';
import { EditorOperationError } from './types';

const textareaAdapter = new TextareaEditorAdapter();
const contentEditableAdapter = new ContentEditableEditorAdapter();
const SEMANTIC_FALLBACK = 'textarea, [contenteditable="true"], [role="textbox"]';

function delegateFor(element: HTMLElement): EditorAdapter {
  if (textareaAdapter.isSupportedEditor(element)) return textareaAdapter;
  if (contentEditableAdapter.isSupportedEditor(element)) return contentEditableAdapter;
  throw new EditorOperationError(
    'UNSUPPORTED_EDITOR',
    'The matched site element is not a safe prompt editor.',
  );
}

abstract class SiteEditorAdapter implements EditorAdapter {
  abstract readonly site: SupportedSite;
  abstract readonly priority: number;

  get id(): string {
    return this.site;
  }

  matchesPage(location: Location): boolean {
    return SITE_HOSTNAMES[this.site].includes(location.hostname.toLowerCase());
  }

  findEditor(document: Document): HTMLElement | null {
    const selectors = [...SITE_EDITOR_SELECTORS[this.site], SEMANTIC_FALLBACK];
    for (const selector of selectors) {
      for (const candidate of document.querySelectorAll(selector)) {
        if (candidate instanceof HTMLElement && this.isSupportedEditor(candidate)) return candidate;
      }
    }
    return null;
  }

  isSupportedEditor(element: Element): boolean {
    if (!(element instanceof HTMLElement)) return false;
    return (
      textareaAdapter.isSupportedEditor(element) ||
      contentEditableAdapter.isSupportedEditor(element)
    );
  }

  readText(element: HTMLElement): string {
    return delegateFor(element).readText(element);
  }

  replaceText(element: HTMLElement, text: string): Promise<void> {
    return delegateFor(element).replaceText(element, text);
  }

  insertText(element: HTMLElement, text: string, mode: EditorInsertMode): Promise<void> {
    return delegateFor(element).insertText(element, text, mode);
  }

  getSelection(element: HTMLElement): EditorSelection {
    return delegateFor(element).getSelection(element);
  }

  focus(element: HTMLElement): void {
    delegateFor(element).focus(element);
  }
}

export class ChatGPTEditorAdapter extends SiteEditorAdapter {
  readonly site = 'chatgpt';
  readonly priority = 100;
}

export class ClaudeEditorAdapter extends SiteEditorAdapter {
  readonly site = 'claude';
  readonly priority = 90;
}

export class GeminiEditorAdapter extends SiteEditorAdapter {
  readonly site = 'gemini';
  readonly priority = 80;
}

export class PerplexityEditorAdapter extends SiteEditorAdapter {
  readonly site = 'perplexity';
  readonly priority = 70;
}
