import { z } from 'zod';

export const outputFormatSchema = z.enum(['plain-text', 'markdown', 'json', 'yaml']);
export type OutputFormat = z.infer<typeof outputFormatSchema>;

export const compressionLevelSchema = z.enum(['light', 'balanced', 'aggressive']);
export type CompressionLevel = z.infer<typeof compressionLevelSchema>;

export const promptInputSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).optional(),
  value: z.string(),
});
export type PromptInput = z.infer<typeof promptInputSchema>;

export const expectedOutputSchema = z.object({
  format: outputFormatSchema,
  length: z.enum(['brief', 'standard', 'detailed']).optional(),
  schema: z.record(z.string(), z.unknown()).optional(),
  instructions: z.array(z.string()).optional(),
});
export type ExpectedOutput = z.infer<typeof expectedOutputSchema>;

export const promptSpecSchema = z.object({
  task: z.string(),
  context: z.array(z.string()),
  inputs: z.array(promptInputSchema),
  constraints: z.array(z.string()),
  expectedOutput: expectedOutputSchema.optional(),
  examples: z.array(z.string()),
  metadata: z
    .object({
      source: z.enum(['manual', 'parsed', 'snippet', 'transformed']),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
    })
    .optional(),
});
export type PromptSpec = z.infer<typeof promptSpecSchema>;

export type PromptLintSeverity = 'info' | 'warning' | 'error';
export type PromptLintCode =
  | 'MISSING_TASK'
  | 'AMBIGUOUS_TASK'
  | 'MISSING_OUTPUT'
  | 'REPEATED_SENTENCE'
  | 'REPEATED_CONSTRAINT'
  | 'CONTRADICTORY_LENGTH'
  | 'EXCESSIVE_FILLER'
  | 'LONG_BACKGROUND_BEFORE_TASK'
  | 'UNCLEAR_REFERENCE'
  | 'POSSIBLE_SECRET'
  | 'TOO_MANY_FORMATS';

export interface PromptLintFinding {
  code: PromptLintCode;
  severity: PromptLintSeverity;
  message: string;
  start?: number;
  end?: number;
  suggestion?: string;
}

export interface PromptLintResult {
  findings: PromptLintFinding[];
  metrics: {
    characters: number;
    words: number;
    approximateTokens: number;
    repeatedSentenceCount: number;
  };
}

export interface PromptTransformResult {
  original: string;
  transformed: string;
  warnings: string[];
  removedSegments: string[];
  changed: boolean;
  metrics: {
    originalCharacters: number;
    transformedCharacters: number;
    originalApproximateTokens: number;
    transformedApproximateTokens: number;
    reductionPercentage: number;
  };
}

export const promptSnippetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  template: z.string().min(1),
  category: z.string().optional(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PromptSnippet = z.infer<typeof promptSnippetSchema>;
export const promptSnippetsSchema = z.array(promptSnippetSchema);

export const extensionSettingsSchema = z.object({
  enabled: z.boolean(),
  siteEnabled: z.record(z.string(), z.boolean()),
  toolbarPosition: z.enum(['above', 'below', 'auto']),
  compressionDefault: compressionLevelSchema,
  defaultOutputFormat: outputFormatSchema,
  showTokenEstimate: z.boolean(),
  genericEditorFallback: z.boolean(),
});
export type ExtensionSettings = z.infer<typeof extensionSettingsSchema>;

export const activeEditorStatusSchema = z.object({
  adapterId: z.string().nullable(),
  editorDetected: z.boolean(),
  lastErrorCode: z.string().nullable(),
});
export type ActiveEditorStatus = z.infer<typeof activeEditorStatusSchema>;

export const extensionMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('GET_SETTINGS') }),
  z.object({ type: z.literal('UPDATE_SETTINGS'), payload: extensionSettingsSchema }),
  z.object({ type: z.literal('GET_SNIPPETS') }),
  z.object({ type: z.literal('SAVE_SNIPPET'), payload: promptSnippetSchema }),
  z.object({ type: z.literal('DELETE_SNIPPET'), payload: z.object({ id: z.string().min(1) }) }),
  z.object({ type: z.literal('RESET_SNIPPETS') }),
  z.object({ type: z.literal('OPEN_SNIPPET_SETTINGS') }),
  z.object({ type: z.literal('GET_ACTIVE_EDITOR_STATUS') }),
  z.object({ type: z.literal('REPORT_ACTIVE_EDITOR_STATUS'), payload: activeEditorStatusSchema }),
]);
export type ExtensionMessage = z.infer<typeof extensionMessageSchema>;
