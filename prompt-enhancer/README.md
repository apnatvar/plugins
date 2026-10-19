# Prompt Composer

Prompt Composer is a Chrome extension for reviewing, formatting, and reusing prompts beside compatible editors across the web. It is published and supported by [Brownsmith Dynamics](https://brownsmithdynamics.com).

## Features

- Compact Shadow DOM toolbar for compatible `textarea` and `contenteditable` editors across HTTP and HTTPS websites.
- Deterministic prompt parsing, linting, and format conversion.
- Plain text, Markdown, JSON, and YAML serializers.
- Before/after preview with warnings, removed segments, insertion, copy, and one-level undo.
- Searchable snippets with local variables and runtime validation.
- Personal snippet management: add, edit, duplicate, enable, disable, and delete snippets locally.
- Chrome Side Panel for snippets, website access, settings, and privacy information.
- A default allowlist for popular AI editors, with custom hostname controls and an optional all-websites mode.
- Local fixture and bundled-Chromium acceptance suite; no live-site login is required for tests.

## Requirements

- Node.js 22 or a current supported Node.js LTS release.
- pnpm 10.x (`packageManager` pins `pnpm@10.15.0`).
- Chrome/Chromium 116 or newer.

## Setup and commands

```bash
pnpm install
pnpm dev
```

Useful root commands:

| Command          | Purpose                                                         |
| ---------------- | --------------------------------------------------------------- |
| `pnpm dev`       | Start WXT development mode.                                     |
| `pnpm fixture`   | Serve the editor fixture at `http://127.0.0.1:4173`.            |
| `pnpm lint`      | Run ESLint.                                                     |
| `pnpm typecheck` | Run strict TypeScript checks in every workspace package.        |
| `pnpm test`      | Run unit and component tests.                                   |
| `pnpm test:e2e`  | Build and test the unpacked MV3 extension in bundled Chromium.  |
| `pnpm build`     | Produce the unpacked production extension.                      |
| `pnpm zip`       | Produce a distributable archive under `apps/extension/.output`. |

On this Windows workspace, tests intentionally use one Vitest worker. Playwright needs permission to launch its bundled Chromium process.

## Load in Chrome

1. Run `pnpm build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select `apps/extension/.output/chrome-mv3`.
6. Open the local fixture with `pnpm fixture`, focus a supported editor, and use the toolbar.
7. Click the extension action to open its side panel.

For development builds, run `pnpm dev`, load the WXT development output shown in the terminal, and use **Reload** on `chrome://extensions` after changes when necessary.

To inspect runtime output, use the page DevTools console for the content script and the **service worker** link on the extension card for background diagnostics. Prompt bodies are not logged.

## Repository structure

```text
apps/extension/              WXT React MV3 application and UI entrypoints
packages/shared-types/       Zod schemas and cross-package message/domain types
packages/prompt-core/        Framework-independent parser, compiler, lint, transforms, snippets
packages/extension-storage/  Versioned chrome.storage.local state and migrations
packages/editor-adapters/    Generic and site-specific editor integration
fixtures/                    Local acceptance page
tests/e2e/                   Persistent-context Playwright extension tests
docs/                        Architecture, adapter, privacy, testing, and limitations guides
```

Only `apps/extension` depends directly on WXT. Prompt logic remains framework-independent TypeScript.

## Documentation

- [Architecture](docs/architecture.md)
- [Editor adapters](docs/editor-adapters.md)
- [Privacy](docs/privacy.md)
- [Manual testing](docs/manual-testing.md)
- [Known limitations](docs/known-limitations.md)
- [Chrome Web Store listing](store-assets/CHROME_WEB_STORE_LISTING.md)
- [Public privacy policy text](store-assets/PRIVACY_POLICY.md)

## Chrome Web Store package

Run `pnpm zip` to create the uploadable `apps/extension/.output/prompt-composer-0.2.3-chrome.zip`. Store-ready icons, screenshots, promotional images, listing copy, permission explanations, and privacy-policy text are in `store-assets`.

Before submitting, publish `store-assets/PRIVACY_POLICY.md` at a public HTTPS URL and enter that URL in the Chrome Web Store privacy section.

## Website access defaults

Unknown websites are disabled by default. The initial allowlist includes ChatGPT, Claude, Gemini, Google AI Studio, Perplexity, Meshy, Sarvam, Grok, Copilot, Poe, DeepSeek, Mistral and Meta AI. Users can remove any entry, add another hostname, or explicitly enable All websites from Settings.

## Automated acceptance

`pnpm test:e2e` builds the extension, serves the local fixture, starts Playwright's bundled Chromium with a persistent context, and loads `apps/extension/.output/chrome-mv3`. It verifies toolbar lifecycle, preview-before-replace, undo, snippet expansion, dynamic and recreated editors, contenteditable cursor behavior, controlled-editor input events, aggressive warnings, privacy, stored settings, and custom snippets.

The local fixture is the authoritative automated acceptance environment. ChatGPT, Claude, Gemini, and Perplexity adapters have selector fixtures, but authenticated live-site passes are intentionally recorded separately in [manual testing](docs/manual-testing.md).
