import type { PromptSnippet } from '@prompt-composer/shared-types';

export interface SnippetVariables {
  selection?: string;
  clipboard?: string;
  page_title?: string;
  page_url?: string;
  current_prompt?: string;
  date?: string;
}

export interface SnippetExpansionResult {
  text: string;
  warnings: string[];
  usedVariables: string[];
}

const KNOWN_VARIABLES = new Set<keyof SnippetVariables>([
  'selection',
  'clipboard',
  'page_title',
  'page_url',
  'current_prompt',
  'date',
]);

export function expandSnippetTemplate(
  template: string,
  variables: SnippetVariables,
): SnippetExpansionResult {
  const warnings: string[] = [];
  const usedVariables: string[] = [];
  const text = template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (placeholder, name: string) => {
    if (!KNOWN_VARIABLES.has(name as keyof SnippetVariables)) {
      warnings.push(`Unknown snippet variable: ${name}`);
      return placeholder;
    }
    usedVariables.push(name);
    const value = variables[name as keyof SnippetVariables];
    if (value === undefined) {
      warnings.push(`Snippet variable is unavailable: ${name}`);
      return placeholder;
    }
    return value;
  });
  return { text, warnings: [...new Set(warnings)], usedVariables: [...new Set(usedVariables)] };
}

const SEEDED_AT = '2026-07-14T00:00:00.000Z';

function snippet(
  id: string,
  name: string,
  description: string,
  category: string,
  template: string,
): PromptSnippet {
  return {
    id,
    name,
    description,
    category,
    template: template.trim(),
    enabled: true,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  };
}

export const DEFAULT_SNIPPETS: PromptSnippet[] = [
  snippet(
    'default-code-review',
    'Code review',
    'Review selected code for substantive issues.',
    'Code',
    `Task:
Review the following code for correctness, security and maintainability.

Input:
{{selection}}

Constraints:
- Prioritise substantive problems.
- Avoid cosmetic changes unless they affect readability.
- Preserve intended behaviour.

Expected output:
Return issues ranked by severity, followed by corrected code where required.`,
  ),
  snippet(
    'default-frontend-component',
    'Frontend component',
    'Build a production-ready frontend component.',
    'Code',
    `Task:
Build the described frontend component.

Context:
Use Next.js App Router, TypeScript, Tailwind CSS and Shadcn/UI.

Input:
{{current_prompt}}

Constraints:
- Use accessible semantic HTML.
- Keep the component responsive.
- Avoid unnecessary dependencies.
- Include revelant meta tags and metadata if applicable.

Expected output:
Return production-ready code and any required installation commands.`,
  ),
  snippet(
    'default-research',
    'Research',
    'Research a selected topic with source discipline.',
    'Research',
    `Task:
Research the following topic and produce a grounded answer.

Topic:
{{selection}}

Constraints:
- Separate verified facts from inference.
- Prefer primary and authoritative sources.
- Mention material uncertainty.

Expected output:
Return a concise synthesis followed by sources.`,
  ),
  snippet(
    'default-rewrite',
    'Rewrite',
    'Rewrite selected text clearly and concisely.',
    'Writing',
    `Task:
Rewrite the supplied text.

Input:
{{selection}}

Constraints:
- Preserve the original meaning.
- Improve clarity and concision.
- Remove repetition.
- Avoid exaggerated language.

Expected output:
Return only the revised text.`,
  ),
];
