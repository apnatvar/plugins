import '../../assets/tailwind.css';
import {
  ContentEditableEditorAdapter,
  ChatGPTEditorAdapter,
  ClaudeEditorAdapter,
  EditorAdapterRegistry,
  EditorDetector,
  GeminiEditorAdapter,
  PerplexityEditorAdapter,
  TextareaEditorAdapter,
  type ActiveEditor,
  type EditorAdapter,
} from '@prompt-composer/editor-adapters';
import {
  createChromeStorageArea,
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  isHostnameEnabled,
  migrateStoredState,
} from '@prompt-composer/extension-storage';
import { DEFAULT_SNIPPETS } from '@prompt-composer/prompt-core';
import {
  extensionSettingsSchema,
  promptSnippetsSchema,
  type ExtensionSettings,
  type PromptSnippet,
} from '@prompt-composer/shared-types';
import ReactDOM from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { PromptToolbar } from '../../components/PromptToolbar';

const websiteMatches = ['http://*/*', 'https://*/*'];

export default defineContentScript({
  matches: websiteMatches,
  cssInjectionMode: 'ui',
  async main(ctx) {
    let active: ActiveEditor | null = null;
    let settings: ExtensionSettings = structuredClone(DEFAULT_SETTINGS);
    let snippets: PromptSnippet[] = structuredClone(DEFAULT_SNIPPETS);
    let toolbarRoot: Root | null = null;
    let detector: EditorDetector | null = null;
    let renderVersion = 0;
    const storage = createChromeStorageArea();

    const openSnippetSettings = async () => {
      const response: unknown = await chrome.runtime.sendMessage({ type: 'OPEN_SNIPPET_SETTINGS' });
      if (
        !response ||
        typeof response !== 'object' ||
        !('ok' in response) ||
        response.ok !== true
      ) {
        throw new Error('Snippet settings could not be opened.');
      }
    };

    const renderToolbar = () => {
      renderVersion += 1;
      toolbarRoot?.render(
        <PromptToolbar
          key={renderVersion}
          active={active}
          settings={settings}
          snippets={snippets}
          onConfigureSnippets={openSnippetSettings}
        />,
      );
    };

    const isEnabled = () =>
      settings.enabled && isHostnameEnabled(settings, window.location.hostname);

    const reportActive = (next: ActiveEditor | null) => {
      if (!ctx.isValid) return;
      try {
        void chrome.runtime
          .sendMessage({
            type: 'REPORT_ACTIVE_EDITOR_STATUS',
            payload: {
              adapterId: next?.adapter.id ?? null,
              editorDetected: next !== null,
              lastErrorCode: null,
            },
          })
          .catch(() => {
            // Extension reloads invalidate existing content-script contexts.
            // Status reporting is optional and must not become a recorded runtime error.
          });
      } catch {
        // The context can be invalidated between the validity check and the API call.
      }
    };

    const restartDetector = () => {
      detector?.stop();
      detector = null;
      active = null;
      renderToolbar();
      if (!isEnabled()) {
        reportActive(null);
        return;
      }
      const adapters: EditorAdapter[] = [
        new ChatGPTEditorAdapter(),
        new ClaudeEditorAdapter(),
        new GeminiEditorAdapter(),
        new PerplexityEditorAdapter(),
      ];
      if (settings.genericEditorFallback) {
        adapters.push(new TextareaEditorAdapter(), new ContentEditableEditorAdapter());
      }
      detector = new EditorDetector({
        document,
        registry: new EditorAdapterRegistry(adapters),
        onChange(next) {
          active = next;
          renderToolbar();
          reportActive(next);
        },
      });
      detector.start();
    };

    const loadConfiguration = async (): Promise<boolean> => {
      try {
        const record = await storage.get(STORAGE_KEY);
        const state = migrateStoredState(record[STORAGE_KEY]);
        if (!ctx.isValid) return false;
        settings = extensionSettingsSchema.parse(state.settings);
        snippets = promptSnippetsSchema.parse(state.snippets);
        return true;
      } catch {
        return false;
      }
    };

    const ui = await createShadowRootUi(ctx, {
      name: 'prompt-composer-toolbar',
      position: 'overlay',
      anchor: 'body',
      isolateEvents: true,
      onMount(container) {
        const app = document.createElement('div');
        app.dataset.promptComposerUi = 'true';
        container.append(app);
        const root = ReactDOM.createRoot(app);
        toolbarRoot = root;
        root.render(
          <PromptToolbar
            key={renderVersion}
            active={active}
            settings={settings}
            snippets={snippets}
            onConfigureSnippets={openSnippetSettings}
          />,
        );
        return { root };
      },
      onRemove(mounted) {
        mounted?.root.unmount();
        toolbarRoot = null;
      },
    });
    ui.mount();
    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== 'local' || !(STORAGE_KEY in changes)) return;
      void loadConfiguration().then((loaded) => {
        if (loaded) restartDetector();
      });
    };
    chrome.storage.onChanged.addListener(onStorageChanged);
    ctx.onInvalidated(() => {
      chrome.storage.onChanged.removeListener(onStorageChanged);
      detector?.stop();
      ui.remove();
    });
    if (await loadConfiguration()) restartDetector();
  },
});
