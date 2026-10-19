export const SITE_FIXTURES = {
  chatgpt:
    '<div id="prompt-textarea" class="ProseMirror" contenteditable="true" role="textbox"></div>',
  claude:
    '<div class="ProseMirror" contenteditable="true" role="textbox" data-testid="chat-input-editor"></div>',
  gemini:
    '<rich-textarea><div class="ql-editor" contenteditable="true" role="textbox"></div></rich-textarea>',
  perplexity: '<textarea placeholder="Ask anything"></textarea>',
} as const;
