import { describe, expect, it } from 'vitest';
import { compressPrompt, structurePrompt } from '../src';

const repeated =
  'Build a responsive card component. Use TypeScript. Use TypeScript. The component must be responsive. Make sure it works responsively. Use Tailwind CSS. Do not add external dependencies.';

describe('structurePrompt', () => {
  it('moves an identifiable task into a labelled section', () => {
    const result = structurePrompt('The app is local-first. Build a Chrome extension. Use WXT.');
    expect(result.transformed).toMatch(/^Task:\nBuild a Chrome extension\./);
    expect(result.transformed).toContain('Constraints:');
    expect(result.transformed).toContain('local-first');
  });

  it('does not invent a task', () => {
    const result = structurePrompt('The application uses PostgreSQL and Redis.');
    expect(result.transformed).not.toContain('Task:');
    expect(result.warnings).toHaveLength(1);
  });
});

describe('compressPrompt', () => {
  it('removes exact repetition in light mode', () => {
    const result = compressPrompt(
      'Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet. Rewrite this in one paragraph.',
      'light',
    );
    expect(result.transformed.match(/Lorem ipsum/g)).toHaveLength(1);
    expect(result.removedSegments).toContain('Lorem ipsum dolor sit amet.');
  });

  it('deduplicates constraints in balanced mode', () => {
    const result = compressPrompt(repeated, 'balanced');
    expect(result.transformed).toContain('Task:\nBuild a responsive card component.');
    expect(result.transformed.match(/Use TypeScript/g)).toHaveLength(1);
    expect(result.transformed).toContain('- Use Tailwind CSS.');
    expect(result.transformed).toContain('- Avoid external dependencies.');
    expect(result.transformed).not.toContain('works responsively');
  });

  it('always warns that aggressive mode is lossy', () => {
    const result = compressPrompt(
      'Build a component. This is incidental background about our office. Use TypeScript.',
      'aggressive',
    );
    expect(result.warnings.join(' ')).toMatch(/lossy|remove context/i);
    expect(result.removedSegments).toContain('This is incidental background about our office.');
  });

  it.each(['light', 'balanced', 'aggressive'] as const)(
    'preserves numbers, filenames and technical requirements in %s mode',
    (level) => {
      const input =
        'Task:\nReview `src/app/page.tsx`.\n\nConstraints:\n- Keep 128 unchanged.\n- Use Next.js 16.\n- Return no more than 7 findings.\n- Preserve https://example.com/api.';
      const output = compressPrompt(input, level).transformed;
      expect(output).toContain('src/app/page.tsx');
      expect(output).toContain('128');
      expect(output).toContain('Next.js 16');
      expect(output).toContain('7 findings');
      expect(output).toContain('https://example.com/api');
    },
  );

  it('reports deterministic before and after metrics', () => {
    const result = compressPrompt('Build it. Build it.', 'light');
    expect(result.metrics.originalCharacters).toBe(19);
    expect(result.metrics.transformedCharacters).toBeLessThan(19);
    expect(result.metrics.reductionPercentage).toBeGreaterThan(0);
  });
});
