// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  ContentEditableEditorAdapter,
  EditorAdapterRegistry,
  EditorDetector,
  TextareaEditorAdapter,
} from '../src';

describe('generic editor adapters', () => {
  it('prioritises textarea and excludes sensitive or irrelevant inputs', () => {
    document.body.innerHTML = `
      <input type="search" />
      <input type="password" />
      <textarea id="draft"></textarea>
      <div contenteditable="true"></div>`;
    const textarea = document.querySelector('#draft')!;
    const registry = new EditorAdapterRegistry([
      new ContentEditableEditorAdapter(),
      new TextareaEditorAdapter(),
    ]);
    expect(registry.findForElement(textarea)?.id).toBe('generic-textarea');
    expect(registry.findForElement(document.querySelector('input[type="search"]')!)).toBeNull();
  });

  it('reads, replaces, verifies and positions a textarea cursor', async () => {
    document.body.innerHTML = '<textarea id="draft">before</textarea>';
    const element = document.querySelector<HTMLTextAreaElement>('#draft')!;
    const adapter = new TextareaEditorAdapter();
    const onInput = vi.fn();
    element.addEventListener('input', onInput);
    await adapter.replaceText(element, 'after');
    expect(adapter.readText(element)).toBe('after');
    expect(element.selectionStart).toBe(5);
    expect(onInput).toHaveBeenCalledOnce();
  });

  it('supports contenteditable replacement and selection-safe focus', async () => {
    document.body.innerHTML = '<div id="draft" contenteditable="true">before</div>';
    const element = document.querySelector<HTMLElement>('#draft')!;
    const adapter = new ContentEditableEditorAdapter();
    await adapter.replaceText(element, 'after');
    expect(adapter.readText(element)).toBe('after');
    expect(document.activeElement).toBe(element);
  });

  it('preserves multiline contenteditable text during verified replacement', async () => {
    document.body.innerHTML = '<div id="draft" contenteditable="true">before</div>';
    const element = document.querySelector<HTMLElement>('#draft')!;
    const adapter = new ContentEditableEditorAdapter();
    await adapter.replaceText(element, 'First line.\nSecond line.');
    expect(adapter.readText(element)).toBe('First line.\nSecond line.');
  });

  it('tracks one active editor and cleans up when it is removed', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<textarea id="draft"></textarea>';
    const changes = vi.fn();
    const detector = new EditorDetector({
      document,
      registry: new EditorAdapterRegistry([new TextareaEditorAdapter()]),
      onChange: changes,
      debounceMs: 5,
    });
    detector.start();
    const element = document.querySelector<HTMLTextAreaElement>('#draft')!;
    element.focus();
    expect(detector.getActive()?.element).toBe(element);
    element.remove();
    await vi.runAllTimersAsync();
    expect(detector.getActive()).toBeNull();
    detector.stop();
    vi.useRealTimers();
  });

  it('debounces input notifications for the current editor', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<textarea id="draft"></textarea>';
    const changes = vi.fn();
    const detector = new EditorDetector({
      document,
      registry: new EditorAdapterRegistry([new TextareaEditorAdapter()]),
      onChange: changes,
      debounceMs: 5,
    });
    detector.start();
    const element = document.querySelector<HTMLTextAreaElement>('#draft')!;
    element.focus();
    changes.mockClear();
    element.value = 'A current draft';
    element.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'A current draft' }));
    await vi.runAllTimersAsync();
    expect(changes).toHaveBeenCalledOnce();
    expect(changes).toHaveBeenCalledWith(expect.objectContaining({ element }));
    detector.stop();
    vi.useRealTimers();
  });
});
