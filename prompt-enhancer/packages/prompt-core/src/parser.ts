import type { ExpectedOutput, OutputFormat, PromptSpec } from '@prompt-composer/shared-types';

const TASK_VERBS =
  /\b(build|create|write|review|audit|research|rewrite|explain|summari[sz]e|analyse|analyze|implement|fix|design|convert|return|generate|compare|identify)\b/i;
const CONSTRAINT_SIGNALS =
  /\b(must|should|use |avoid|do not|don't|without|preserve|keep|make sure|no more than|local[- ]first|responsive|accessible)\b/i;
const OUTPUT_SIGNALS =
  /\b(return|respond|output|provide|give me|format|as (?:json|yaml|markdown))\b/i;
const HEADING =
  /^(task|context|background|input|inputs|constraints?|requirements?|expected output|output|examples?):\s*(.*)$/i;

function cleanLine(line: string): string {
  return line
    .trim()
    .replace(/^[-*]\s+/, '')
    .trim();
}

function detectOutputFormat(text: string): OutputFormat {
  if (/\bjson\b/i.test(text)) return 'json';
  if (/\byaml\b/i.test(text)) return 'yaml';
  if (/\bmarkdown\b/i.test(text)) return 'markdown';
  return 'plain-text';
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(cleanLine)
    .filter(Boolean);
}

function parseHeadedDraft(draft: string): PromptSpec | null {
  const lines = draft.split(/\r?\n/);
  if (!lines.some((line) => HEADING.test(line.trim()))) return null;

  const sections = new Map<string, string[]>();
  let current = 'context';
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(HEADING);
    if (match) {
      current = match[1]!.toLowerCase();
      sections.set(current, sections.get(current) ?? []);
      if (match[2]) sections.get(current)!.push(cleanLine(match[2]));
    } else {
      sections.set(current, [...(sections.get(current) ?? []), cleanLine(line)]);
    }
  }

  const get = (...keys: string[]) => keys.flatMap((key) => sections.get(key) ?? []);
  const outputLines = get('expected output', 'output');
  return {
    task: get('task').join(' ').trim(),
    context: get('context', 'background'),
    inputs: get('input', 'inputs').map((value, index) => ({ id: `input-${index + 1}`, value })),
    constraints: get('constraint', 'constraints', 'requirement', 'requirements'),
    expectedOutput: outputLines.length
      ? { format: detectOutputFormat(outputLines.join(' ')), instructions: outputLines }
      : undefined,
    examples: get('example', 'examples'),
  };
}

export function parseDraftToPromptSpec(draft: string): PromptSpec {
  const normalized = draft.trim();
  const headed = parseHeadedDraft(normalized);
  if (headed) return headed;

  const sentences = splitSentences(normalized);
  const taskIndex = sentences.findIndex((sentence) => TASK_VERBS.test(sentence));
  const task = taskIndex >= 0 ? sentences[taskIndex]! : '';
  const constraints = sentences.filter(
    (sentence, index) => index !== taskIndex && CONSTRAINT_SIGNALS.test(sentence),
  );
  const outputSentence = sentences.find((sentence) => OUTPUT_SIGNALS.test(sentence));
  const context = sentences.filter(
    (sentence, index) =>
      index !== taskIndex && sentence !== outputSentence && !constraints.includes(sentence),
  );
  let expectedOutput: ExpectedOutput | undefined;
  if (outputSentence) {
    expectedOutput = {
      format: detectOutputFormat(outputSentence),
      instructions: [outputSentence],
    };
    if (/\bbrief|concise|short\b/i.test(outputSentence)) expectedOutput.length = 'brief';
    if (/\bdetailed|comprehensive|thorough\b/i.test(outputSentence))
      expectedOutput.length = 'detailed';
  }

  return { task, context, inputs: [], constraints, expectedOutput, examples: [] };
}
