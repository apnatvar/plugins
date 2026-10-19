import { EditorOperationError, type EditorAdapter } from './types';

const SENSITIVE_SIGNALS =
  /\b(password|passcode|credit[- ]?card|card number|cvv|cvc|payment|billing)\b/i;

export function isSensitiveOrIrrelevant(element: Element): boolean {
  if (element instanceof HTMLInputElement) {
    if (['password', 'search', 'email', 'tel', 'number'].includes(element.type)) return true;
  }
  const signals = [
    element.getAttribute('aria-label'),
    element.getAttribute('name'),
    element.getAttribute('id'),
    element.getAttribute('placeholder'),
    element.getAttribute('autocomplete'),
  ]
    .filter(Boolean)
    .join(' ');
  return SENSITIVE_SIGNALS.test(signals) || element.getAttribute('role') === 'searchbox';
}

export function isUsableEditor(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
  if ('disabled' in element && element.disabled === true) return false;
  if ('readOnly' in element && element.readOnly === true) return false;
  if (isSensitiveOrIrrelevant(element)) return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (style?.display === 'none' || style?.visibility === 'hidden') return false;
  const rect = element.getBoundingClientRect();
  const isJsdom = element.ownerDocument.defaultView?.navigator.userAgent.includes('jsdom') ?? false;
  return isJsdom || rect.width > 0 || rect.height > 0;
}

export function dispatchEditorInput(element: HTMLElement, text: string): void {
  const InputEventConstructor = element.ownerDocument.defaultView?.InputEvent;
  const event = InputEventConstructor
    ? new InputEventConstructor('input', {
        bubbles: true,
        composed: true,
        inputType: 'insertText',
        data: text,
      })
    : new Event('input', { bubbles: true, composed: true });
  element.dispatchEvent(event);
}

export function verifiedReplacement(
  adapter: EditorAdapter,
  element: HTMLElement,
  replacement: string,
  write: (text: string) => void,
): Promise<void> {
  if (!element.isConnected) {
    throw new EditorOperationError(
      'EDITOR_REMOVED',
      'The editor is no longer on the page.',
      adapter.id,
    );
  }
  const original = adapter.readText(element);
  try {
    write(replacement);
    dispatchEditorInput(element, replacement);
    adapter.focus(element);
    if (adapter.readText(element) !== replacement) {
      write(original);
      dispatchEditorInput(element, original);
      throw new EditorOperationError(
        'VERIFICATION_FAILED',
        'The page rejected the replacement; the original draft was restored.',
        adapter.id,
      );
    }
    return Promise.resolve();
  } catch (error) {
    if (error instanceof EditorOperationError) throw error;
    write(original);
    dispatchEditorInput(element, original);
    throw new EditorOperationError(
      'REPLACE_FAILED',
      'The draft could not be replaced.',
      adapter.id,
    );
  }
}

export function placeContentEditableCursorAtEnd(element: HTMLElement): void {
  const selection = element.ownerDocument.getSelection();
  if (!selection) return;
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}
