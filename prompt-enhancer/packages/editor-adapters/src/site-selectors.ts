/**
 * Site selectors are isolated here because public chat products change often.
 * Ordered alternatives start with a product-owned identifier and end with a
 * semantic editor signal. Every candidate still passes generic safety checks.
 */
export const SITE_EDITOR_SELECTORS = {
  chatgpt: [
    '#prompt-textarea', // Current stable prompt editor id.
    'div.ProseMirror[contenteditable="true"]', // ProseMirror editor used by prior/current composer builds.
    'textarea[data-id="root"]', // Legacy textarea composer.
  ],
  claude: [
    '[contenteditable="true"][data-testid*="chat-input"]', // Product test id when present.
    '.ProseMirror[contenteditable="true"]', // Claude's ProseMirror composer.
    'div[role="textbox"]', // Semantic fallback used during UI experiments.
  ],
  gemini: [
    '.ql-editor[contenteditable="true"]', // Quill-based Gemini composer.
    'rich-textarea [contenteditable="true"]', // Gemini custom-element wrapper.
    'div[role="textbox"][contenteditable="true"]', // Semantic fallback.
  ],
  perplexity: [
    'textarea[placeholder*="Ask" i]', // Textarea composer variant.
    '[data-lexical-editor="true"]', // Lexical editor variant.
    'div[contenteditable="true"][role="textbox"]', // Semantic fallback.
  ],
} as const;

export type SupportedSite = keyof typeof SITE_EDITOR_SELECTORS;

export const SITE_HOSTNAMES: Record<SupportedSite, readonly string[]> = {
  chatgpt: ['chatgpt.com', 'www.chatgpt.com'],
  claude: ['claude.ai', 'www.claude.ai'],
  gemini: ['gemini.google.com'],
  perplexity: ['perplexity.ai', 'www.perplexity.ai'],
};
