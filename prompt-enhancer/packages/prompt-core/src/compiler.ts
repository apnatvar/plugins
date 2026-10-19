import type { OutputFormat, PromptSpec } from '@prompt-composer/shared-types';
import { stringify as stringifyYaml } from 'yaml';

function compactSpec(spec: PromptSpec): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({
      task: spec.task,
      context: spec.context,
      inputs: spec.inputs,
      constraints: spec.constraints,
      expectedOutput: spec.expectedOutput,
      examples: spec.examples,
    }).filter(([, value]) => {
      if (value === undefined || value === '') return false;
      return !Array.isArray(value) || value.length > 0;
    }),
  );
}

function renderPlainSection(title: string, values: string[]): string {
  if (values.length === 0) return '';
  return `${title}:\n${values.map((value) => `- ${value}`).join('\n')}`;
}

function compilePlainText(spec: PromptSpec): string {
  const sections = [spec.task ? `Task:\n${spec.task}` : ''];
  sections.push(renderPlainSection('Context', spec.context));
  if (spec.inputs.length) {
    sections.push(
      `Inputs:\n${spec.inputs
        .map((input) => `- ${input.label ? `${input.label}: ` : ''}${input.value}`)
        .join('\n')}`,
    );
  }
  sections.push(renderPlainSection('Constraints', spec.constraints));
  if (spec.expectedOutput) {
    const instructions = spec.expectedOutput.instructions ?? [];
    const format =
      spec.expectedOutput.format === 'plain-text'
        ? []
        : [`Use ${spec.expectedOutput.format.toUpperCase()} format.`];
    sections.push(renderPlainSection('Expected output', [...instructions, ...format]));
  }
  sections.push(renderPlainSection('Examples', spec.examples));
  return sections.filter(Boolean).join('\n\n');
}

function renderMarkdownSection(title: string, values: string[]): string {
  if (values.length === 0) return '';
  return `## ${title}\n\n${values.map((value) => `- ${value}`).join('\n')}`;
}

function compileMarkdown(spec: PromptSpec): string {
  const sections = [spec.task ? `## Task\n\n${spec.task}` : ''];
  sections.push(renderMarkdownSection('Context', spec.context));
  sections.push(
    renderMarkdownSection(
      'Inputs',
      spec.inputs.map((input) => `${input.label ? `${input.label}: ` : ''}${input.value}`),
    ),
  );
  sections.push(renderMarkdownSection('Constraints', spec.constraints));
  if (spec.expectedOutput) {
    const details = [
      ...(spec.expectedOutput.instructions ?? []),
      `Format: ${spec.expectedOutput.format}`,
    ];
    sections.push(renderMarkdownSection('Expected output', details));
  }
  sections.push(renderMarkdownSection('Examples', spec.examples));
  return sections.filter(Boolean).join('\n\n');
}

export function compilePrompt(spec: PromptSpec, format: OutputFormat): string {
  switch (format) {
    case 'plain-text':
      return compilePlainText(spec);
    case 'markdown':
      return compileMarkdown(spec);
    case 'json':
      return JSON.stringify(compactSpec(spec), null, 2);
    case 'yaml':
      return stringifyYaml(compactSpec(spec), { lineWidth: 0 }).trim();
  }
}
