# Architecture

Maintained by [Brownsmith Dynamics](https://brownsmithdynamics.com).

## Boundaries

Prompt Composer is a pnpm workspace with one browser application and four reusable packages.

```text
Web editor
  -> content-script detector and adapter
  -> Shadow DOM React toolbar
  -> local prompt-core transformation
  -> verified adapter replacement or insertion

Side panel
  -> validated runtime message
  -> MV3 service worker
  -> versioned chrome.storage.local state
  -> storage change refresh in the content script
```

`apps/extension` owns all WXT, Chrome API, and React integration. The parser, serializers, lint rules, compression, snippet expansion, and shared types do not import WXT.

## Workspaces

### `packages/shared-types`

Defines Zod-backed prompt, lint, transform, snippet, settings, active-editor, and runtime-message schemas. Runtime message payloads are parsed before background handling.

### `packages/prompt-core`

Contains deterministic functions:

- `parseDraftToPromptSpec`
- `compilePrompt`
- `lintPrompt`
- `structurePrompt`
- `compressPrompt`
- `expandSnippetTemplate`

Transformations return data; they do not read the DOM, storage, clipboard, or network.

### `packages/extension-storage`

Owns the versioned settings schema, default website allowlist, validation, migration, corruption recovery, local persistence, snippet updates, and reset behavior. Only settings and snippet metadata/templates are stored. Drafts and undo snapshots are excluded.

### `packages/editor-adapters`

Defines the editor contract and implements generic textarea/contenteditable behavior plus isolated site selectors. Replacements dispatch a composed input event, restore focus/cursor, read the value back, and roll back if verification fails.

### `apps/extension`

- `background.ts` validates messages, mediates browser storage, maintains runtime status, and configures action-click Side Panel behavior.
- `content/index.tsx` loads settings/snippets, starts the detector, reacts to local storage changes, and mounts one WXT Shadow Root UI.
- `PromptToolbar.tsx` runs prompt-core operations locally and owns per-editor in-memory undo snapshots.
- `sidepanel/` manages snippets, website access, settings, and privacy information.

## Runtime lifecycle

1. The content script mounts an isolated empty Shadow Root UI.
2. It reads and validates settings and snippets from extension storage.
3. Enabled site/generic adapters are registered by priority.
4. Focus, input, selection, mutation, resize, and scroll events keep one active editor and toolbar current.
5. A toolbar action reads the editor at click time and prepares a pure transformation result.
6. The editor remains unchanged until the user confirms replacement or insertion.
7. The adapter writes, dispatches input, restores focus/cursor, and verifies the page accepted the value.
8. One original value is retained in a `WeakMap` for session-only undo.

## Data and messaging

Messages use a discriminated union (`GET_SETTINGS`, `UPDATE_SETTINGS`, snippet CRUD, and editor status). Full prompt text is intentionally absent. Prompt parsing and transformation run inside the content-script bundle, not the background service worker.

Changes to the versioned local state cause a content-script configuration reload. This applies global/site enablement, generic fallback, custom/disabled snippets, toolbar placement, default labels, and token-estimate visibility without a page reload.

## Failure model

Adapter errors use stable codes such as `EDITOR_REMOVED`, `REPLACE_FAILED`, and `VERIFICATION_FAILED`. On a rejected replacement, the adapter restores the original draft before surfacing the error. Diagnostics store only the adapter id, detection state, and error code—not editor text.
