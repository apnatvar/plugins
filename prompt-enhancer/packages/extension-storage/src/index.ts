import { DEFAULT_SNIPPETS } from '@prompt-composer/prompt-core';
import {
  extensionSettingsSchema,
  promptSnippetSchema,
  type ExtensionSettings,
  type PromptSnippet,
} from '@prompt-composer/shared-types';
import { z } from 'zod';

export const STORAGE_KEY = 'promptComposerState';
export const STORAGE_SCHEMA_VERSION = 5 as const;

export const DEFAULT_ALLOWED_HOSTNAMES = [
  'chatgpt.com',
  'claude.ai',
  'gemini.google.com',
  'aistudio.google.com',
  'www.perplexity.ai',
  'perplexity.ai',
  'meshy.ai',
  'www.meshy.ai',
  'sarvam.ai',
  'www.sarvam.ai',
  'try.sarvam.ai',
  'grok.com',
  'copilot.microsoft.com',
  'poe.com',
  'chat.deepseek.com',
  'chat.mistral.ai',
  'www.meta.ai',
] as const;

function createDefaultSiteEnabled(): Record<string, boolean> {
  return {
    '*': false,
    ...Object.fromEntries(DEFAULT_ALLOWED_HOSTNAMES.map((hostname) => [hostname, true])),
  };
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  siteEnabled: createDefaultSiteEnabled(),
  toolbarPosition: 'auto',
  compressionDefault: 'balanced',
  defaultOutputFormat: 'plain-text',
  showTokenEstimate: true,
  genericEditorFallback: true,
};

export const storedExtensionStateSchema = z.object({
  schemaVersion: z.literal(STORAGE_SCHEMA_VERSION),
  settings: extensionSettingsSchema,
  snippets: z.array(promptSnippetSchema),
});

const storedExtensionStateV1Schema = z.object({
  schemaVersion: z.literal(1),
  settings: extensionSettingsSchema,
  snippets: z.array(promptSnippetSchema),
});

const storedExtensionStateV2Schema = z.object({
  schemaVersion: z.literal(2),
  settings: extensionSettingsSchema,
  snippets: z.array(promptSnippetSchema),
});

const storedExtensionStateV3Schema = z.object({
  schemaVersion: z.literal(3),
  settings: extensionSettingsSchema,
  snippets: z.array(promptSnippetSchema),
});

const storedExtensionStateV4Schema = z.object({
  schemaVersion: z.literal(4),
  settings: extensionSettingsSchema,
  snippets: z.array(promptSnippetSchema),
});

const previousSiteNames: Record<string, string> = {
  chatgpt: 'chatgpt.com',
  claude: 'claude.ai',
  gemini: 'gemini.google.com',
  perplexity: 'www.perplexity.ai',
  localhost: 'localhost',
};

function upgradeSettings(settings: ExtensionSettings): ExtensionSettings {
  const siteEnabled: Record<string, boolean> = {
    '*': settings.siteEnabled['*'] ?? true,
  };
  for (const [site, enabled] of Object.entries(settings.siteEnabled)) {
    if (site === '*') continue;
    siteEnabled[previousSiteNames[site] ?? site.toLowerCase()] = enabled;
  }
  return { ...settings, siteEnabled };
}

function upgradeToDefaultAllowlist(settings: ExtensionSettings): ExtensionSettings {
  const normalized = upgradeSettings(settings);
  if (normalized.siteEnabled['*'] === false) return normalized;

  const siteEnabled = createDefaultSiteEnabled();
  for (const [hostname, enabled] of Object.entries(normalized.siteEnabled)) {
    if (hostname !== '*') siteEnabled[hostname] = enabled;
  }
  return { ...normalized, siteEnabled };
}

export type StoredExtensionState = z.infer<typeof storedExtensionStateSchema>;

export interface LocalStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export function createDefaultState(): StoredExtensionState {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    settings: structuredClone(DEFAULT_SETTINGS),
    snippets: structuredClone(DEFAULT_SNIPPETS),
  };
}

export function migrateStoredState(value: unknown): StoredExtensionState {
  const current = storedExtensionStateSchema.safeParse(value);
  if (current.success) return current.data;

  const versionFour = storedExtensionStateV4Schema.safeParse(value);
  if (versionFour.success) {
    return {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      settings: upgradeToDefaultAllowlist(versionFour.data.settings),
      snippets: versionFour.data.snippets,
    };
  }

  const versionThree = storedExtensionStateV3Schema.safeParse(value);
  if (versionThree.success) {
    return {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      settings: upgradeToDefaultAllowlist(versionThree.data.settings),
      snippets: versionThree.data.snippets,
    };
  }

  const versionTwo = storedExtensionStateV2Schema.safeParse(value);
  if (versionTwo.success) {
    return {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      settings: upgradeToDefaultAllowlist(versionTwo.data.settings),
      snippets: versionTwo.data.snippets,
    };
  }

  const previous = storedExtensionStateV1Schema.safeParse(value);
  if (previous.success) {
    return {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      settings: upgradeToDefaultAllowlist(previous.data.settings),
      snippets: previous.data.snippets.filter((snippet) => snippet.id !== 'default-seo-audit'),
    };
  }

  if (value && typeof value === 'object') {
    const legacy = value as Record<string, unknown>;
    const settings = extensionSettingsSchema.safeParse(legacy.settings);
    const snippets = z.array(promptSnippetSchema).safeParse(legacy.snippets);
    if ((legacy.schemaVersion === 0 || legacy.schemaVersion === undefined) && settings.success) {
      return {
        schemaVersion: STORAGE_SCHEMA_VERSION,
        settings: upgradeToDefaultAllowlist(settings.data),
        snippets: snippets.success ? snippets.data : structuredClone(DEFAULT_SNIPPETS),
      };
    }
  }
  return createDefaultState();
}

export async function loadStoredState(area: LocalStorageArea): Promise<StoredExtensionState> {
  const record = await area.get(STORAGE_KEY);
  const state = migrateStoredState(record[STORAGE_KEY]);
  await area.set({ [STORAGE_KEY]: state });
  return state;
}

export async function saveStoredState(
  area: LocalStorageArea,
  state: StoredExtensionState,
): Promise<StoredExtensionState> {
  const validated = storedExtensionStateSchema.parse(state);
  await area.set({ [STORAGE_KEY]: validated });
  return validated;
}

export async function resetStoredState(area: LocalStorageArea): Promise<StoredExtensionState> {
  const state = createDefaultState();
  await area.set({ [STORAGE_KEY]: state });
  return state;
}

export function createChromeStorageArea(): LocalStorageArea {
  return {
    get: (key) => chrome.storage.local.get(key),
    set: (items) => chrome.storage.local.set(items),
    remove: (key) => chrome.storage.local.remove(key),
  };
}

export function updateSnippet(
  state: StoredExtensionState,
  snippet: PromptSnippet,
): StoredExtensionState {
  const validated = promptSnippetSchema.parse(snippet);
  const exists = state.snippets.some((item) => item.id === validated.id);
  return {
    ...state,
    snippets: exists
      ? state.snippets.map((item) => (item.id === validated.id ? validated : item))
      : [...state.snippets, validated],
  };
}

export function isHostnameEnabled(settings: ExtensionSettings, hostname: string): boolean {
  return settings.siteEnabled[hostname.toLowerCase()] ?? settings.siteEnabled['*'] ?? false;
}
