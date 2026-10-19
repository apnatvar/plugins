# Known limitations

Maintained by [Brownsmith Dynamics](https://brownsmithdynamics.com).

- ChatGPT, Claude, Gemini, and Perplexity were not manually exercised in authenticated live sessions on 2026-07-14. Their static selector fixtures pass, but public DOM changes may require selector updates. See `manual-testing.md`.
- The parser, lint rules, and compressors are deterministic heuristics, not language models. They can misclassify unusual prose and do not infer missing facts.
- Token counts use a documented character-based approximation and are not billing/tokenizer exact.
- Generic contenteditable replacement is plain text and does not preserve rich-text markup.
- Some controlled or framework-owned editors may reject programmatic replacement. Verification then restores the original and reports an adapter error.
- Undo retains one snapshot per editor in page memory. Navigation, reload, editor replacement, or extension restart can discard it.
- `{{clipboard}}` is recognized but unavailable because the extension intentionally has no clipboard-read permission or read action. The placeholder remains and a warning is shown.
- Optimized selectors are maintained for ChatGPT, Claude, Gemini, and Perplexity. Other websites rely on standard textarea and contenteditable detection.
- The Side Panel requires Chrome/Chromium 114 or newer. Automated extension tests use Playwright's bundled Chromium, not an installed Chrome profile.
- On this Windows/pnpm dependency graph, `define-lazy-prop@2.0.0` is pinned to keep CommonJS `open@8` build tooling deterministic when pnpm hoists transitive dependencies. This affects development tooling only, not extension runtime code.
