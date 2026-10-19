import { isUsableEditor, verifiedReplacement } from './dom';
import type { EditorAdapter, EditorInsertMode, EditorSelection } from './types';
import { EditorOperationError } from './types';

function asTextarea(element: HTMLElement): HTMLTextAreaElement {
  if (!(element instanceof HTMLTextAreaElement)) {
    throw new EditorOperationError('UNSUPPORTED_EDITOR', 'Expected a textarea editor.');
  }
  return element;
}

function setTextareaValue(element: HTMLTextAreaElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  descriptor?.set?.call(element, value);
  if (!descriptor?.set) element.value = value;
  element.setSelectionRange(value.length, value.length);
}

export class TextareaEditorAdapter implements EditorAdapter {
  readonly id = 'generic-textarea';
  readonly priority = 20;

  matchesPage(): boolean {
    return true;
  }

  findEditor(document: Document): HTMLElement | null {
    return (
      [...document.querySelectorAll('textarea')].find((item) => this.isSupportedEditor(item)) ??
      null
    );
  }

  isSupportedEditor(element: Element): boolean {
    return element instanceof HTMLTextAreaElement && isUsableEditor(element);
  }

  readText(element: HTMLElement): string {
    return asTextarea(element).value;
  }

  async replaceText(element: HTMLElement, text: string): Promise<void> {
    const textarea = asTextarea(element);
    await verifiedReplacement(this, textarea, text, (value) => setTextareaValue(textarea, value));
  }

  async insertText(element: HTMLElement, text: string, mode: EditorInsertMode): Promise<void> {
    const textarea = asTextarea(element);
    const original = textarea.value;
    const start = textarea.selectionStart ?? original.length;
    const end = textarea.selectionEnd ?? start;
    const replacement =
      mode === 'append'
        ? `${original}${original ? '\n' : ''}${text}`
        : mode === 'replace-selection'
          ? `${original.slice(0, start)}${text}${original.slice(end)}`
          : `${original.slice(0, start)}${text}${original.slice(start)}`;
    await this.replaceText(textarea, replacement);
  }

  getSelection(element: HTMLElement): EditorSelection {
    const textarea = asTextarea(element);
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    return { text: textarea.value.slice(start, end), start, end };
  }

  focus(element: HTMLElement): void {
    const textarea = asTextarea(element);
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }
}
