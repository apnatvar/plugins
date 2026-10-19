import {
  createChromeStorageArea,
  loadStoredState,
  saveStoredState,
  updateSnippet,
} from '@prompt-composer/extension-storage';
import { DEFAULT_SNIPPETS } from '@prompt-composer/prompt-core';
import {
  extensionMessageSchema,
  type ActiveEditorStatus,
  type ExtensionMessage,
} from '@prompt-composer/shared-types';

const editorStatusByTab = new Map<number, ActiveEditorStatus>();
let latestEditorStatus: ActiveEditorStatus = {
  adapterId: null,
  editorDetected: false,
  lastErrorCode: null,
};

async function handleMessage(message: ExtensionMessage, tabId?: number): Promise<unknown> {
  const storage = createChromeStorageArea();
  switch (message.type) {
    case 'GET_SETTINGS':
      return (await loadStoredState(storage)).settings;
    case 'UPDATE_SETTINGS': {
      const state = await loadStoredState(storage);
      state.settings = message.payload;
      return (await saveStoredState(storage, state)).settings;
    }
    case 'GET_SNIPPETS':
      return (await loadStoredState(storage)).snippets;
    case 'SAVE_SNIPPET': {
      const state = updateSnippet(await loadStoredState(storage), message.payload);
      return (await saveStoredState(storage, state)).snippets;
    }
    case 'DELETE_SNIPPET': {
      const state = await loadStoredState(storage);
      state.snippets = state.snippets.filter((snippet) => snippet.id !== message.payload.id);
      return (await saveStoredState(storage, state)).snippets;
    }
    case 'RESET_SNIPPETS': {
      const state = await loadStoredState(storage);
      state.snippets = structuredClone(DEFAULT_SNIPPETS);
      return (await saveStoredState(storage, state)).snippets;
    }
    case 'OPEN_SNIPPET_SETTINGS':
      if (tabId === undefined) throw new Error('Snippet settings require an active tab.');
      try {
        await chrome.sidePanel.open({ tabId });
        return { ok: true, surface: 'side-panel' };
      } catch {
        await chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
        return { ok: true, surface: 'tab' };
      }
    case 'GET_ACTIVE_EDITOR_STATUS':
      return tabId === undefined
        ? latestEditorStatus
        : (editorStatusByTab.get(tabId) ?? latestEditorStatus);
    case 'REPORT_ACTIVE_EDITOR_STATUS':
      latestEditorStatus = message.payload;
      if (tabId !== undefined) editorStatusByTab.set(tabId, message.payload);
      return { ok: true };
  }
}

export default defineBackground(() => {
  const configureSidePanel = () => {
    try {
      void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
        // Chrome may invalidate the service worker while an updated extension is loading.
      });
    } catch {
      // The service worker may be invalidated before the API call begins.
    }
  };

  configureSidePanel();
  chrome.runtime.onInstalled.addListener(() => {
    configureSidePanel();
  });
  chrome.runtime.onMessage.addListener((rawMessage: unknown, sender, sendResponse) => {
    const parsed = extensionMessageSchema.safeParse(rawMessage);
    if (!parsed.success) {
      sendResponse({ error: 'INVALID_MESSAGE' });
      return false;
    }
    void handleMessage(parsed.data, sender.tab?.id)
      .then(sendResponse)
      .catch(() => sendResponse({ error: 'LOCAL_OPERATION_FAILED' }));
    return true;
  });
});
