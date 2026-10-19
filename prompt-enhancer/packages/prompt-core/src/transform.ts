import type {
  CompressionLevel,
  PromptSpec,
  PromptTransformResult,
} from '@prompt-composer/shared-types';
import { compilePrompt } from './compiler';
import { estimateApproximateTokens } from './metrics';
import { parseDraftToPromptSpec } from './parser';

const FILLER_AT_START =
  /^(?:so(?:,|\s+)|basically(?:,|\s+)|actually(?:,|\s+)|please\s+|i think\s+|i would like(?: you)? to\s+|i am trying to\s+)/i;

function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s./:_-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeLayout(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      const heading = trimmed.match(
        /^#{1,6}\s*(task|context|background|inputs?|constraints?|expected output|output|examples?)\s*:?[\s#]*$/i,
      );
      if (heading) return `${heading[1]!.replace(/\b\w/g, (letter) => letter.toUpperCase())}:`;
      return trimmed.replace(/^[*•]\s+/, '- ');
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function lightTransform(text: string): { text: string; removed: string[] } {
  const normalized = normalizeLayout(text);
  const seen = new Set<string>();
  const removed: string[] = [];
  const transformed = splitSentences(normalized)
    .map((sentence) => sentence.replace(FILLER_AT_START, '').trim())
    .filter((sentence) => {
      const key = normalizeKey(sentence);
      if (seen.has(key)) {
        removed.push(sentence);
        return false;
      }
      seen.add(key);
      return true;
    })
    .join('\n');
  return { text: transformed, removed };
}

function canonicalConstraint(constraint: string): string {
  const text = constraint.trim();
  if (/\b(?:do not add|without|avoid)\s+(?:any\s+)?external dependencies\b/i.test(text)) {
    return 'Avoid external dependencies.';
  }
  if (/\bresponsiv(?:e|ely)\b/i.test(text)) return 'Keep it responsive.';
  if (/^use\s+/i.test(text)) return `${text.replace(/[.!]+$/, '')}.`;
  return text.replace(/^make sure (?:that )?/i, '').replace(/[.!]+$/, '') + '.';
}

function dedupeConstraints(
  constraints: string[],
  task: string,
): { kept: string[]; removed: string[] } {
  const kept: string[] = [];
  const removed: string[] = [];
  const seen = new Set<string>();
  for (const raw of constraints) {
    const constraint = canonicalConstraint(raw);
    const key = normalizeKey(constraint)
      .replace(/\b(?:keep it|must be|works?)\b/g, '')
      .trim();
    if (seen.has(key) || (/responsive/.test(key) && /responsive/i.test(task))) {
      removed.push(raw);
      continue;
    }
    seen.add(key);
    kept.push(constraint);
  }
  return { kept, removed };
}

const VERBOSE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bin order to\b/gi, 'to'],
  [/\bdue to the fact that\b/gi, 'because'],
  [/\bat this point in time\b/gi, 'now'],
  [/\bfor the purpose of\b/gi, 'for'],
  [/\ba large number of\b/gi, 'many'],
  [/\bhas the ability to\b/gi, 'can'],
  [/\bdo not want a backend right now\b/gi, 'use no backend'],
];

function shortenVerbosePhrases(text: string): string {
  return VERBOSE_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text,
  );
}

function balancedTransform(original: string): { text: string; removed: string[] } {
  const light = lightTransform(original);
  const spec = parseDraftToPromptSpec(shortenVerbosePhrases(light.text));
  const deduped = dedupeConstraints(spec.constraints, spec.task);
  const balancedSpec: PromptSpec = {
    ...spec,
    context: [...new Map(spec.context.map((item) => [normalizeKey(item), item])).values()],
    constraints: deduped.kept,
  };
  return {
    text: compilePrompt(balancedSpec, 'plain-text') || light.text,
    removed: [...light.removed, ...deduped.removed],
  };
}

function isEssentialContext(sentence: string): boolean {
  return (
    /\b(?:https?:\/\/|[\w/-]+\.[a-z]{1,5}\b|\d+|must|requires?|because|depends?|local[- ]first|backend|api|database)\b/i.test(
      sentence,
    ) ||
    /\b(?:React|TypeScript|WXT|Next\.js|Tailwind|Chrome|Claude|Gemini|Perplexity)\b/.test(sentence)
  );
}

function aggressiveTransform(original: string): { text: string; removed: string[] } {
  const balanced = balancedTransform(original);
  const spec = parseDraftToPromptSpec(balanced.text);
  const essentialContext = spec.context.filter(isEssentialContext);
  const removedContext = spec.context.filter((item) => !essentialContext.includes(item));
  const compact: PromptSpec = { ...spec, context: essentialContext, examples: [] };
  return {
    text: compilePrompt(compact, 'plain-text') || balanced.text,
    removed: [...balanced.removed, ...removedContext, ...spec.examples],
  };
}

function makeResult(
  original: string,
  transformed: string,
  warnings: string[],
  removedSegments: string[],
): PromptTransformResult {
  const originalTokens = estimateApproximateTokens(original);
  const transformedTokens = estimateApproximateTokens(transformed);
  const reduction = original.length
    ? Math.max(0, Math.round(((original.length - transformed.length) / original.length) * 100))
    : 0;
  return {
    original,
    transformed,
    warnings,
    removedSegments: [...new Set(removedSegments)].filter(Boolean),
    changed: original !== transformed,
    metrics: {
      originalCharacters: original.length,
      transformedCharacters: transformed.length,
      originalApproximateTokens: originalTokens,
      transformedApproximateTokens: transformedTokens,
      reductionPercentage: reduction,
    },
  };
}

export function structurePrompt(draft: string): PromptTransformResult {
  const spec = parseDraftToPromptSpec(draft);
  const warnings = spec.task
    ? []
    : ['No clear task was detected; the transformation did not invent one.'];
  return makeResult(draft, compilePrompt(spec, 'plain-text') || draft.trim(), warnings, []);
}

export function compressPrompt(draft: string, level: CompressionLevel): PromptTransformResult {
  if (level === 'light') {
    const result = lightTransform(draft);
    return makeResult(draft, result.text, [], result.removed);
  }
  if (level === 'balanced') {
    const result = balancedTransform(draft);
    return makeResult(draft, result.text, [], result.removed);
  }
  const result = aggressiveTransform(draft);
  return makeResult(
    draft,
    result.text,
    [
      'Aggressive compression is potentially lossy.',
      'Aggressive compression may remove context that affects the answer. Review the result before replacing the draft.',
    ],
    result.removed,
  );
}
