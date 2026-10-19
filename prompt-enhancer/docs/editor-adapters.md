# Editor adapters

Maintained by [Brownsmith Dynamics](https://brownsmithdynamics.com).

## Contract

Every adapter supplies page matching, editor discovery/support checks, text reading, verified replacement, insertion, selection, and focus behavior. The registry chooses the highest-priority compatible adapter for the focused element.

Generic adapters support visible, enabled, writable textareas and contenteditable/role-textbox elements. Password, search, email, telephone, number, hidden, disabled, readonly, searchbox, and sensitive-labelled controls are rejected before text is read.

## Replacement safety

Textarea replacement uses the native value setter so controlled pages receive a browser-like update. Contenteditable replacement writes rendered plain text. Both paths:

1. retain the original value in memory;
2. write the candidate value;
3. dispatch a bubbling, composed `input` event;
4. focus the editor and place the cursor at the end;
5. read the editor back;
6. restore the original and throw `VERIFICATION_FAILED` if it differs.

Rich-text markup is not preserved; the MVP intentionally treats prompt drafts as plain text.

## Detection lifecycle

`EditorDetector` listens in the capture phase for focus, input, and selection changes and observes DOM additions/removals. Input refreshes are debounced but sticky so a later selection event cannot discard the pending text refresh. Removed editors are cleared, recreated/dynamic editors are detected, and only the active supported editor produces a toolbar.

## Site adapters and selectors

Selectors are isolated in `packages/editor-adapters/src/site-selectors.ts` so public DOM changes require a small, auditable edit.

| Site       | Host                | Ordered selector signals                                                           |
| ---------- | ------------------- | ---------------------------------------------------------------------------------- |
| ChatGPT    | `chatgpt.com`       | `#prompt-textarea`, ProseMirror contenteditable, legacy `textarea[data-id="root"]` |
| Claude     | `claude.ai`         | chat-input test id, ProseMirror contenteditable, role textbox                      |
| Gemini     | `gemini.google.com` | Quill editor, `rich-textarea` contenteditable, semantic contenteditable textbox    |
| Perplexity | `www.perplexity.ai` | Ask textarea, Lexical editor, semantic contenteditable textbox                     |

Each site adapter reuses the generic safety and replacement primitives. A semantic fallback is attempted only after product-specific selectors, and global/site/generic-fallback settings control registration at runtime.

## Updating a selector

1. Add the smallest product-owned or semantic selector to `site-selectors.ts`.
2. Add/update its static DOM fixture in `packages/editor-adapters/tests/site-fixtures.ts`.
3. Run `pnpm test`, `pnpm typecheck`, and the manual checklist.
4. Record live behavior and date in `docs/manual-testing.md`.

Do not put site selectors in React components or prompt-core packages. A live public-site DOM change does not invalidate the local fixture as the authoritative automated environment.
