import {
  dispatchEditorInput,
  isUsableEditor,
  placeContentEditableCursorAtEnd,
  verifiedReplacement,
} from './dom';
import type { EditorAdapter, EditorInsertMode, EditorSelection } from './types';

export class ContentEditableEditorAdapter implements EditorAdapter {
  readonly id = 'generic-contenteditable';
  readonly priority = 10;

  matchesPage(): boolean {
    return true;
  }

  findEditor(document: Document): HTMLElement | null {
    const match = [...document.querySelectorAll('[contenteditable="true"], [role="textbox"]')].find(
      (item) => this.isSupportedEditor(item),
    );
    return match instanceof HTMLElement ? match : null;
  }

  isSupportedEditor(element: Element): boolean {
    return (
      element instanceof HTMLElement &&
      (element.isContentEditable || element.getAttribute('role') === 'textbox') &&
      isUsableEditor(element)
    );
  }

  readText(element: HTMLElement): string {
    return element.innerText || element.textContent || '';
  }

  async replaceText(element: HTMLElement, text: string): Promise<void> {
    await verifiedReplacement(this, element, text, (value) => {
      const isJsdom =
        element.ownerDocument.defaultView?.navigator.userAgent.includes('jsdom') ?? false;
      if (isJsdom) element.textContent = value;
      else element.innerText = value;
      placeContentEditableCursorAtEnd(element);
    });
  }

  async insertText(element: HTMLElement, text: string, mode: EditorInsertMode): Promise<void> {
    const original = this.readText(element);
    if (mode === 'append') {
      await this.replaceText(element, `${original}${original ? '\n' : ''}${text}`);
      return;
    }
    const selection = this.getSelection(element);
    if (mode === 'replace-selection' && selection.text) {
      const range = element.ownerDocument.getSelection()?.getRangeAt(0);
      if (range) {
        range.deleteContents();
        range.insertNode(element.ownerDocument.createTextNode(text));
        dispatchEditorInput(element, text);
        placeContentEditableCursorAtEnd(element);
        return;
      }
    }
    await this.replaceText(element, `${original}${text}`);
  }

  getSelection(element: HTMLElement): EditorSelection {
    const selection = element.ownerDocument.getSelection();
    if (!selection || !selection.anchorNode || !element.contains(selection.anchorNode))
      return { text: '' };
    return { text: selection.toString() };
  }

  focus(element: HTMLElement): void {
    element.focus({ preventScroll: true });
    placeContentEditableCursorAtEnd(element);
  }
}
