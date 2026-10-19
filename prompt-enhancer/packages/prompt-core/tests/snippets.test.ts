import { describe, expect, it } from 'vitest';
import { DEFAULT_SNIPPETS, expandSnippetTemplate } from '../src';

describe('snippets', () => {
  it('seeds the required starter snippets', () => {
    expect(DEFAULT_SNIPPETS.map((snippet) => snippet.name)).toEqual([
      'Code review',
      'Frontend component',
      'Research',
      'Rewrite',
    ]);
  });

  it('substitutes available local variables', () => {
    const result = expandSnippetTemplate(
      '{{selection}} | {{page_title}} | {{page_url}} | {{current_prompt}} | {{date}}',
      {
        selection: 'selected',
        page_title: 'Fixture',
        page_url: 'http://127.0.0.1:4173',
        current_prompt: 'draft',
        date: '2026-07-14',
      },
    );
    expect(result.text).toBe('selected | Fixture | http://127.0.0.1:4173 | draft | 2026-07-14');
    expect(result.warnings).toEqual([]);
  });

  it('keeps unknown and unavailable variables visible with warnings', () => {
    const result = expandSnippetTemplate('{{unknown}} {{clipboard}}', {});
    expect(result.text).toBe('{{unknown}} {{clipboard}}');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'Unknown snippet variable: unknown',
        'Snippet variable is unavailable: clipboard',
      ]),
    );
  });
});
