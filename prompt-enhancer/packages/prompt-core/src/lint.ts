import type {
  PromptLintFinding,
  PromptLintResult,
  PromptLintSeverity,
} from '@prompt-composer/shared-types';
import { countWords, estimateApproximateTokens } from './metrics';
import { parseDraftToPromptSpec } from './parser';

const TASK_VERB =
  /\b(build|create|write|review|audit|research|rewrite|explain|summari[sz]e|analyse|analyze|implement|fix|design|convert|generate|compare|identify)\b/i;
const OUTPUT_WORDS = /\b(return|respond|output|provide|format|as json|as yaml|as markdown)\b/i;
const FILLER_PATTERNS = [
  /\bso\b/gi,
  /\bbasically\b/gi,
  /\bsort of\b/gi,
  /\bkind of\b/gi,
  /\bi think\b/gi,
  /\bi would like\b/gi,
  /\bplease\b/gi,
  /\bjust\b/gi,
  /\bactually\b/gi,
  /\btrying to\b/gi,
];
const CONSTRAINT_SIGNAL =
  /\b(must|should|use|avoid|do not|don't|without|preserve|keep|no more than|responsive|accessible)\b/i;

interface SentenceSpan {
  text: string;
  start: number;
  end: number;
}

function splitSentencesWithOffsets(text: string): SentenceSpan[] {
  const result: SentenceSpan[] = [];
  const matcher = /[^.!?\n]+[.!?]?/g;
  for (const match of text.matchAll(matcher)) {
    const raw = match[0];
    const leading = raw.length - raw.trimStart().length;
    const sentence = raw.trim();
    if (!sentence) continue;
    const start = (match.index ?? 0) + leading;
    result.push({ text: sentence, start, end: start + sentence.length });
  }
  return result;
}

function normalizeSentence(sentence: string): string {
  return sentence
    .toLowerCase()
    .replace(/^[-*]\s*/, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function finding(
  code: PromptLintFinding['code'],
  severity: PromptLintSeverity,
  message: string,
  span?: Pick<SentenceSpan, 'start' | 'end'>,
  suggestion?: string,
): PromptLintFinding {
  return { code, severity, message, ...span, suggestion };
}

function findRepeatedSentences(sentences: SentenceSpan[]): PromptLintFinding[] {
  const first = new Map<string, SentenceSpan>();
  const findings: PromptLintFinding[] = [];
  for (const sentence of sentences) {
    const normalized = normalizeSentence(sentence.text);
    if (normalized.length < 10) continue;
    if (first.has(normalized)) {
      findings.push(
        finding(
          'REPEATED_SENTENCE',
          'warning',
          'This sentence repeats an earlier sentence.',
          sentence,
          'Remove the repeated sentence.',
        ),
      );
    } else {
      first.set(normalized, sentence);
    }
  }
  return findings;
}

function findRepeatedConstraints(sentences: SentenceSpan[]): PromptLintFinding[] {
  const seen = new Set<string>();
  const findings: PromptLintFinding[] = [];
  for (const sentence of sentences.filter((item) => CONSTRAINT_SIGNAL.test(item.text))) {
    const normalized = normalizeSentence(sentence.text);
    if (seen.has(normalized)) {
      findings.push(
        finding(
          'REPEATED_CONSTRAINT',
          'warning',
          'This constraint duplicates an earlier constraint.',
          sentence,
          'Keep one copy of the constraint.',
        ),
      );
    }
    seen.add(normalized);
  }
  return findings;
}

function findSecrets(text: string): PromptLintFinding[] {
  const patterns = [
    /\bsk-[A-Za-z0-9_-]{16,}\b/g,
    /\bAIza[0-9A-Za-z_-]{20,}\b/g,
    /\bBearer\s+[A-Za-z0-9._~+/-]{16,}={0,2}\b/gi,
    /\bpassword\s*=\s*[^\s'";]{6,}/gi,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  ];
  const findings: PromptLintFinding[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      findings.push(
        finding(
          'POSSIBLE_SECRET',
          'error',
          'The draft may contain a secret. Remove or redact it before continuing.',
          { start, end: start + match[0].length },
          'Replace the value with a safe placeholder.',
        ),
      );
    }
  }
  return findings;
}

export function lintPrompt(draft: string): PromptLintResult {
  const text = draft.trim();
  const sentences = splitSentencesWithOffsets(draft);
  const parsed = parseDraftToPromptSpec(text);
  const findings: PromptLintFinding[] = [];

  const isVagueTask =
    /^(?:please\s+)?(?:make|improve|fix)\s+(?:it|this|that)(?:\s+better)?[.!]?$/i.test(text);
  if (!text) {
    findings.push(
      finding(
        'MISSING_TASK',
        'error',
        'No actionable task was detected.',
        undefined,
        'State what the assistant should do using a clear action verb.',
      ),
    );
  } else if (isVagueTask) {
    findings.push(
      finding(
        'AMBIGUOUS_TASK',
        'warning',
        'The task does not say what a successful improvement means.',
        { start: 0, end: draft.length },
        'Name the input and the desired change.',
      ),
    );
  } else if (!parsed.task) {
    findings.push(
      finding(
        'MISSING_TASK',
        'error',
        'No actionable task was detected.',
        undefined,
        'State what the assistant should do using a clear action verb.',
      ),
    );
  }

  if (parsed.task && !OUTPUT_WORDS.test(text)) {
    findings.push(
      finding(
        'MISSING_OUTPUT',
        'info',
        'No explicit output shape was detected.',
        undefined,
        'Describe the desired format or deliverable.',
      ),
    );
  }

  findings.push(...findRepeatedSentences(sentences));
  findings.push(...findRepeatedConstraints(sentences));

  const wantsShort = /\b(brief|concise|short|no more than\s+\d+\s+words?)\b/i.test(text);
  const wantsLong = /\b(comprehensive|detailed|thorough|\d{4,}[ -]word)\b/i.test(text);
  if (wantsShort && wantsLong) {
    findings.push(
      finding(
        'CONTRADICTORY_LENGTH',
        'warning',
        'The draft asks for both short and detailed output.',
        undefined,
        'Choose one length requirement or define separate sections.',
      ),
    );
  }

  const fillerCount = FILLER_PATTERNS.reduce(
    (count, pattern) => count + [...text.matchAll(pattern)].length,
    0,
  );
  if (fillerCount >= 3 || (fillerCount >= 2 && text.length > 180)) {
    findings.push(
      finding(
        'EXCESSIVE_FILLER',
        'warning',
        `Detected ${fillerCount} conversational filler phrases.`,
        undefined,
        'Remove conversational lead-ins and state the task directly.',
      ),
    );
  }

  const verbMatch = TASK_VERB.exec(text);
  if (verbMatch && (verbMatch.index ?? 0) > 240) {
    findings.push(
      finding(
        'LONG_BACKGROUND_BEFORE_TASK',
        'warning',
        'A long background section appears before the task.',
        { start: 0, end: verbMatch.index },
        'Move the task before the background context.',
      ),
    );
  }

  if (
    /\b(make|improve|fix)\s+(it|this|that)\b/i.test(text) &&
    !/\b(input|selection|code|text|draft|component|page)\b/i.test(text)
  ) {
    findings.push(
      finding(
        'UNCLEAR_REFERENCE',
        'warning',
        'A vague reference has no explicit input.',
        undefined,
        'Name or include the thing to change.',
      ),
    );
  }

  findings.push(...findSecrets(draft));

  const formats = ['json', 'yaml', 'markdown', 'plain text'].filter((format) =>
    new RegExp(`\\b${format.replace(' ', '\\s+')}\\b`, 'i').test(text),
  );
  if (formats.length > 1) {
    findings.push(
      finding(
        'TOO_MANY_FORMATS',
        'warning',
        `Multiple output formats were requested: ${formats.join(', ')}.`,
        undefined,
        'Choose one primary output format.',
      ),
    );
  }

  return {
    findings,
    metrics: {
      characters: draft.length,
      words: countWords(draft),
      approximateTokens: estimateApproximateTokens(draft),
      repeatedSentenceCount: findings.filter((item) => item.code === 'REPEATED_SENTENCE').length,
    },
  };
}
