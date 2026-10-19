import { describe, expect, it } from 'vitest';
import { estimateApproximateTokens, lintPrompt } from '../src';

const codes = (draft: string) => lintPrompt(draft).findings.map((finding) => finding.code);

describe('lintPrompt', () => {
  it('detects background-only text without inventing a task', () => {
    expect(
      codes('The application uses Next.js, PostgreSQL and Redis. It has twelve routes.'),
    ).toContain('MISSING_TASK');
  });

  it('detects vague tasks and unclear references', () => {
    expect(codes('Make it better.')).toEqual(
      expect.arrayContaining(['AMBIGUOUS_TASK', 'UNCLEAR_REFERENCE']),
    );
  });

  it('detects exact repeated sentences and constraints', () => {
    const result = codes('Build a card. Use TypeScript. Use TypeScript.');
    expect(result).toEqual(expect.arrayContaining(['REPEATED_SENTENCE', 'REPEATED_CONSTRAINT']));
  });

  it('normalises casing and punctuation for repeated constraints', () => {
    expect(codes('Build a card. USE TYPESCRIPT! use typescript.')).toContain('REPEATED_CONSTRAINT');
  });

  it('detects conflicting length requirements and filler', () => {
    const draft =
      'So I am basically trying to write this and I think you should review it. Keep it concise but provide a comprehensive 5,000-word report.';
    expect(codes(draft)).toEqual(
      expect.arrayContaining(['CONTRADICTORY_LENGTH', 'EXCESSIVE_FILLER']),
    );
  });

  it.each([
    'Use this API key: sk-test-12345678901234567890',
    'password=correct-horse-battery',
    'Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345',
    '-----BEGIN PRIVATE KEY-----',
  ])('conservatively detects a possible secret in %s', (draft) => {
    expect(codes(draft)).toContain('POSSIBLE_SECRET');
  });

  it('detects incompatible output formats', () => {
    expect(codes('Review this code and return both JSON and YAML.')).toContain('TOO_MANY_FORMATS');
  });

  it('reports stable local metrics', () => {
    const result = lintPrompt('Build a button.');
    expect(result.metrics).toMatchObject({ characters: 15, words: 3 });
    expect(result.metrics.approximateTokens).toBe(4);
    expect(estimateApproximateTokens('')).toBe(0);
  });
});
