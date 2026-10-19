import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { compilePrompt, parseDraftToPromptSpec } from '../src';
import type { PromptSpec } from '@prompt-composer/shared-types';

const spec: PromptSpec = {
  task: 'Review the selected React component.',
  context: ['The component runs in a Next.js application.'],
  inputs: [],
  constraints: ['Use TypeScript.', 'Preserve existing behaviour.'],
  expectedOutput: {
    format: 'markdown',
    instructions: ['Return a ranked issue list followed by corrected code.'],
  },
  examples: [],
};

describe('parseDraftToPromptSpec', () => {
  it('parses labelled prompt sections predictably', () => {
    const parsed = parseDraftToPromptSpec(
      'Task:\nReview `src/app/page.tsx`.\n\nConstraints:\n- Use TypeScript.\n- Keep 128 unchanged.',
    );
    expect(parsed.task).toBe('Review `src/app/page.tsx`.');
    expect(parsed.constraints).toEqual(['Use TypeScript.', 'Keep 128 unchanged.']);
  });

  it('does not invent a task for background-only text', () => {
    const parsed = parseDraftToPromptSpec(
      'The application uses Next.js, PostgreSQL and Redis. It has twelve routes.',
    );
    expect(parsed.task).toBe('');
  });
});

describe('compilePrompt', () => {
  it.each(['plain-text', 'markdown'] as const)('compiles %s output', (format) => {
    const output = compilePrompt(spec, format);
    expect(output).toContain('Review the selected React component.');
    expect(output).toContain('Use TypeScript.');
  });

  it('produces parseable JSON', () => {
    expect(JSON.parse(compilePrompt(spec, 'json'))).toMatchObject({ task: spec.task });
  });

  it('produces parseable YAML', () => {
    expect(parseYaml(compilePrompt(spec, 'yaml'))).toMatchObject({ task: spec.task });
  });
});
