# Privacy and security

This document describes Prompt Composer's privacy and security behavior.

The public-facing policy text prepared for the Chrome Web Store is maintained in [`store-assets/PRIVACY_POLICY.md`](../store-assets/PRIVACY_POLICY.md). It must be published at a public HTTPS URL before store submission.

## What stays local

- Draft text is read only from the active supported editor.
- Parsing, linting, structure, compression, formatting, and snippet expansion run in the content script using bundled TypeScript.
- The preview and one-level undo snapshot exist only in page memory.
- Settings and snippet definitions are stored in `chrome.storage.local` under a versioned schema.

Drafts, editor contents, prompt history, clipboard contents, previews, and undo snapshots are not persisted.

## Network and submission

The extension has no backend, model API, telemetry, analytics, or fetch/XHR path. It never clicks a host site's submit control and never sends Enter on the user's behalf. Replacement only changes the editor draft; the user reviews and submits it.

The automated privacy scenario enters a secret-like value, verifies the `POSSIBLE_SECRET` warning, checks all extension local storage, and observes page requests to ensure the value is neither stored nor transmitted.

## Clipboard

`Copy result` writes the prepared result only after an explicit click. The snippet engine understands a `{{clipboard}}` variable, but the MVP toolbar does not request clipboard-read permission or populate that variable; it remains visible with an unavailable-variable warning. No clipboard content is stored.

## Permissions

The manifest requests only:

- `storage` for settings and snippet definitions;
- `sidePanel` for the management interface;
- HTTP and HTTPS website access so the toolbar can work beside compatible editors. Runtime access starts with a curated hostname allowlist and can be changed by the user.

No tabs, browsing-history, identity, or remote-code permission is used.

## Sensitive controls and logging

The adapter layer excludes password fields and other sensitive/irrelevant input types before reading. Lint can flag common secret shapes, but it is a local heuristic and not a guarantee of secret detection.

Runtime diagnostics contain only version, adapter id, editor-detected state, error code, and storage schema version. Prompt bodies are not logged or included in background messages.

Product documentation and support are provided by [Brownsmith Dynamics](https://brownsmithdynamics.com).

## Chrome Web Store Limited Use

Prompt Composer's use of information received from browser permissions complies with the Chrome Web Store User Data Policy, including the Limited Use requirements. Browser-provided information is used only for the extension's single purpose: helping the user review, format, and reuse prompt text inside a supported editor.
