import { describe, expect, it } from 'vitest';
import {
  createDefaultState,
  isHostnameEnabled,
  loadStoredState,
  migrateStoredState,
  resetStoredState,
  saveStoredState,
  STORAGE_KEY,
  type LocalStorageArea,
} from '../src';

class MemoryStorage implements LocalStorageArea {
  readonly data: Record<string, unknown> = {};
  get(key: string) {
    return Promise.resolve({ [key]: this.data[key] });
  }
  set(items: Record<string, unknown>) {
    Object.assign(this.data, items);
    return Promise.resolve();
  }
  remove(key: string) {
    delete this.data[key];
    return Promise.resolve();
  }
}

describe('extension storage', () => {
  it('recovers corrupted data to local defaults', () => {
    const state = migrateStoredState({ schemaVersion: 1, settings: 'broken', snippets: [] });
    expect(state.schemaVersion).toBe(5);
    expect(state.snippets).toHaveLength(4);
  });

  it('removes the retired SEO starter while migrating existing local state', () => {
    const defaults = createDefaultState();
    const state = migrateStoredState({
      schemaVersion: 1,
      settings: defaults.settings,
      snippets: [
        ...defaults.snippets,
        {
          ...defaults.snippets[0],
          id: 'default-seo-audit',
          name: 'SEO audit',
        },
      ],
    });
    expect(state.schemaVersion).toBe(5);
    expect(state.snippets.map((snippet) => snippet.id)).not.toContain('default-seo-audit');
  });

  it('upgrades version two state without retaining unknown fields', () => {
    const defaults = createDefaultState();
    const state = migrateStoredState({
      schemaVersion: 2,
      settings: { ...defaults.settings, retiredPrefix: 'old' },
      snippets: defaults.snippets.map((snippet) => ({ ...snippet, retiredShortcut: 'old' })),
    });
    expect(state.schemaVersion).toBe(5);
    expect(JSON.stringify(state)).not.toContain('retiredPrefix');
    expect(JSON.stringify(state)).not.toContain('retiredShortcut');
  });

  it('converts previous site names while migrating to the default allowlist', () => {
    const defaults = createDefaultState();
    const state = migrateStoredState({
      schemaVersion: 3,
      settings: { ...defaults.settings, siteEnabled: { chatgpt: false } },
      snippets: defaults.snippets,
    });
    expect(state.settings.siteEnabled['*']).toBe(false);
    expect(state.settings.siteEnabled['chatgpt.com']).toBe(false);
    expect(state.settings.siteEnabled['claude.ai']).toBe(true);
  });

  it('migrates the previous all-websites default to the seeded allowlist', () => {
    const defaults = createDefaultState();
    const state = migrateStoredState({
      schemaVersion: 4,
      settings: {
        ...defaults.settings,
        siteEnabled: { '*': true, 'example.com': false },
      },
      snippets: defaults.snippets,
    });
    expect(state.schemaVersion).toBe(5);
    expect(state.settings.siteEnabled['*']).toBe(false);
    expect(state.settings.siteEnabled['chatgpt.com']).toBe(true);
    expect(state.settings.siteEnabled['try.sarvam.ai']).toBe(true);
    expect(state.settings.siteEnabled['example.com']).toBe(false);
  });

  it('preserves an existing custom allowlist during migration', () => {
    const defaults = createDefaultState();
    const state = migrateStoredState({
      schemaVersion: 4,
      settings: {
        ...defaults.settings,
        siteEnabled: { '*': false, 'example.com': true },
      },
      snippets: defaults.snippets,
    });
    expect(state.settings.siteEnabled).toEqual({ '*': false, 'example.com': true });
  });

  it('migrates legacy settings and repairs missing snippets', () => {
    const defaults = createDefaultState();
    const state = migrateStoredState({ schemaVersion: 0, settings: defaults.settings });
    expect(state.settings).toEqual(defaults.settings);
    expect(state.snippets).toHaveLength(4);
  });

  it('disallows unknown websites and enables the seeded AI websites by default', () => {
    const defaults = createDefaultState();
    expect(isHostnameEnabled(defaults.settings, 'example.com')).toBe(false);
    expect(isHostnameEnabled(defaults.settings, 'chatgpt.com')).toBe(true);
    expect(isHostnameEnabled(defaults.settings, 'www.meshy.ai')).toBe(true);
    expect(isHostnameEnabled(defaults.settings, 'sarvam.ai')).toBe(true);
    expect(isHostnameEnabled(defaults.settings, 'try.sarvam.ai')).toBe(true);
    const settings = {
      ...defaults.settings,
      siteEnabled: { ...defaults.settings.siteEnabled, 'example.com': true },
    };
    expect(isHostnameEnabled(settings, 'example.com')).toBe(true);
    expect(isHostnameEnabled(settings, 'another.example')).toBe(false);
  });

  it('loads, validates, saves and resets state without prompt content', async () => {
    const storage = new MemoryStorage();
    const loaded = await loadStoredState(storage);
    expect(storage.data[STORAGE_KEY]).toEqual(loaded);
    expect(JSON.stringify(loaded)).not.toContain('editorContents');
    loaded.settings.enabled = false;
    expect((await saveStoredState(storage, loaded)).settings.enabled).toBe(false);
    expect((await resetStoredState(storage)).settings.enabled).toBe(true);
  });
});
