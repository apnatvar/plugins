// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  ChatGPTEditorAdapter,
  ClaudeEditorAdapter,
  ContentEditableEditorAdapter,
  EditorAdapterRegistry,
  GeminiEditorAdapter,
  PerplexityEditorAdapter,
  TextareaEditorAdapter,
  type EditorAdapter,
} from '../src';
import { SITE_FIXTURES } from './site-fixtures';

const siteCases: Array<[string, string, EditorAdapter]> = [
  ['chatgpt.com', SITE_FIXTURES.chatgpt, new ChatGPTEditorAdapter()],
  ['claude.ai', SITE_FIXTURES.claude, new ClaudeEditorAdapter()],
  ['gemini.google.com', SITE_FIXTURES.gemini, new GeminiEditorAdapter()],
  ['www.perplexity.ai', SITE_FIXTURES.perplexity, new PerplexityEditorAdapter()],
];

function locationFor(hostname: string): Location {
  return { hostname } as Location;
}

describe('site-specific adapters', () => {
  it.each(siteCases)(
    'detects, reads and replaces the %s fixture',
    async (hostname, fixture, adapter) => {
      document.body.innerHTML = `${fixture}<input type="search"><input type="password">`;
      expect(adapter.matchesPage(locationFor(hostname), document)).toBe(true);
      const editor = adapter.findEditor(document);
      expect(editor).not.toBeNull();
      await adapter.replaceText(editor!, 'Build a local extension.');
      expect(adapter.readText(editor!)).toBe('Build a local extension.');
      expect(adapter.isSupportedEditor(document.querySelector('input[type="search"]')!)).toBe(
        false,
      );
      expect(adapter.isSupportedEditor(document.querySelector('input[type="password"]')!)).toBe(
        false,
      );
    },
  );

  it('uses site adapters before generic fallbacks', () => {
    document.body.innerHTML = SITE_FIXTURES.chatgpt;
    const editor = document.querySelector('#prompt-textarea')!;
    const registry = new EditorAdapterRegistry([
      new TextareaEditorAdapter(),
      new ContentEditableEditorAdapter(),
      new ChatGPTEditorAdapter(),
    ]);
    expect(registry.findForElement(editor, locationFor('chatgpt.com'))?.id).toBe('chatgpt');
  });

  it('falls back to a safe semantic editor when a product selector changes', () => {
    document.body.innerHTML = '<div role="textbox" contenteditable="true"></div>';
    expect(new GeminiEditorAdapter().findEditor(document)).toBeInstanceOf(HTMLElement);
  });
});
