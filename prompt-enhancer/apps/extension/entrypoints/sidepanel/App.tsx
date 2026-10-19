import {
  extensionSettingsSchema,
  promptSnippetsSchema,
  type ExtensionMessage,
  type ExtensionSettings,
  type PromptSnippet,
} from '@prompt-composer/shared-types';
import { useEffect, useMemo, useState } from 'react';

type PanelSection = 'snippets' | 'settings' | 'privacy';
export type MessageClient = (message: ExtensionMessage) => Promise<unknown>;

const defaultClient: MessageClient = (message) => chrome.runtime.sendMessage(message);

interface AppProps {
  client?: MessageClient;
}

function freshSnippet(): PromptSnippet {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: '',
    description: '',
    template: '',
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeHostname(value: string): string | null {
  const input = value.trim().toLowerCase();
  if (!input) return null;
  try {
    const url = new URL(input.includes('://') ? input : `https://${input}`);
    return url.hostname || null;
  } catch {
    return null;
  }
}

export function App({ client = defaultClient }: AppProps) {
  const [section, setSection] = useState<PanelSection>('snippets');
  const [snippets, setSnippets] = useState<PromptSnippet[]>([]);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [editing, setEditing] = useState<PromptSnippet | null>(null);
  const [query, setQuery] = useState('');
  const [siteInput, setSiteInput] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [snippetValue, settingValue] = await Promise.all([
          client({ type: 'GET_SNIPPETS' }),
          client({ type: 'GET_SETTINGS' }),
        ]);
        if (!active) return;
        setSnippets(promptSnippetsSchema.parse(snippetValue));
        setSettings(extensionSettingsSchema.parse(settingValue));
      } catch {
        if (active) setNotice('Settings could not be loaded. Reopen the extension and try again.');
      }
    })();
    return () => {
      active = false;
    };
  }, [client]);

  const filteredSnippets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return snippets.filter(
      (snippet) =>
        !normalized ||
        snippet.name.toLowerCase().includes(normalized) ||
        snippet.description.toLowerCase().includes(normalized),
    );
  }, [query, snippets]);

  const saveSnippet = async (snippet: PromptSnippet) => {
    const updated = { ...snippet, updatedAt: new Date().toISOString() };
    const response = await client({ type: 'SAVE_SNIPPET', payload: updated });
    setSnippets(promptSnippetsSchema.parse(response));
    setEditing(null);
    setNotice('Snippet saved.');
  };

  const deleteSnippet = async (id: string) => {
    const response = await client({ type: 'DELETE_SNIPPET', payload: { id } });
    setSnippets(promptSnippetsSchema.parse(response));
    setEditing((current) => (current?.id === id ? null : current));
    setNotice('Snippet deleted.');
  };

  const saveSettings = async (next: ExtensionSettings) => {
    const response = await client({ type: 'UPDATE_SETTINGS', payload: next });
    setSettings(extensionSettingsSchema.parse(response));
    setNotice('Settings saved.');
  };

  const addSiteOverride = async () => {
    if (!settings) return;
    const hostname = normalizeHostname(siteInput);
    if (!hostname) {
      setNotice('Enter a valid website hostname.');
      return;
    }
    const enabledForAll = settings.siteEnabled['*'] ?? false;
    await saveSettings({
      ...settings,
      siteEnabled: { ...settings.siteEnabled, [hostname]: !enabledForAll },
    });
    setSiteInput('');
  };

  const removeSiteOverride = async (hostname: string) => {
    if (!settings) return;
    const siteEnabled = { ...settings.siteEnabled };
    delete siteEnabled[hostname];
    await saveSettings({ ...settings, siteEnabled });
  };

  return (
    <main className="min-h-screen bg-paper p-4 text-ink">
      <header className="flex items-center gap-3">
        <img src="/icon-48.png" alt="" className="size-10 object-contain" />
        <div>
          <h1 className="text-xl font-semibold">Prompt Composer</h1>
          <a
            href="https://brownsmithdynamics.com"
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 block text-xs text-slate-600 underline-offset-2 hover:underline"
          >
            Tools by Brownsmith Dynamics
          </a>
        </div>
      </header>

      <nav
        aria-label="Side panel sections"
        className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1"
      >
        {(['snippets', 'settings', 'privacy'] as PanelSection[]).map((item) => (
          <button
            key={item}
            type="button"
            aria-current={section === item ? 'page' : undefined}
            className="rounded-lg px-2 py-2 text-sm font-medium capitalize outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-600 aria-[current=page]:bg-white aria-[current=page]:shadow-sm"
            onClick={() => setSection(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      {section === 'snippets' && (
        <section aria-labelledby="snippets-title" className="mt-5">
          <div className="flex items-center justify-between gap-2">
            <h2 id="snippets-title" className="font-semibold">
              Snippets
            </h2>
            <button
              type="button"
              className="rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white"
              onClick={() => setEditing(freshSnippet())}
            >
              Create
            </button>
          </div>
          <label className="mt-3 block text-xs font-semibold">
            Search snippets
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Name or description"
            />
          </label>
          <div className="mt-3 grid gap-2">
            {filteredSnippets.map((snippet) => (
              <article
                key={snippet.id}
                className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{snippet.name}</h3>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={snippet.enabled}
                      onChange={() => void saveSnippet({ ...snippet, enabled: !snippet.enabled })}
                    />
                    Enabled
                  </label>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">{snippet.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="panel-button"
                    onClick={() => setEditing(snippet)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="panel-button"
                    onClick={() =>
                      void saveSnippet({
                        ...snippet,
                        id: crypto.randomUUID(),
                        name: `${snippet.name} copy`,
                        createdAt: new Date().toISOString(),
                      })
                    }
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="panel-button text-red-700"
                    onClick={() => void deleteSnippet(snippet.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-blue-700"
            onClick={() =>
              void client({ type: 'RESET_SNIPPETS' }).then((value) => {
                setSnippets(promptSnippetsSchema.parse(value));
                setNotice('Default snippets restored.');
              })
            }
          >
            Restore default snippets
          </button>
        </section>
      )}

      {section === 'settings' && settings && (
        <section aria-labelledby="settings-title" className="mt-5 grid gap-4">
          <h2 id="settings-title" className="font-semibold">
            Settings
          </h2>
          <label className="setting-row">
            <span>
              <strong>Extension enabled</strong>
              <small>Show tools on enabled sites.</small>
            </span>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) =>
                void saveSettings({ ...settings, enabled: event.target.checked })
              }
            />
          </label>
          <fieldset className="grid gap-3">
            <legend className="text-sm font-semibold">Website access</legend>
            <label className="setting-row">
              <span>
                <strong>All websites</strong>
                <small>Allow Prompt Composer on every compatible website.</small>
              </span>
              <input
                type="checkbox"
                checked={settings.siteEnabled['*'] ?? false}
                onChange={(event) =>
                  void saveSettings({
                    ...settings,
                    siteEnabled: { ...settings.siteEnabled, '*': event.target.checked },
                  })
                }
              />
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <label className="grid gap-1 text-xs font-semibold">
                Website hostname
                <input
                  value={siteInput}
                  onChange={(event) => setSiteInput(event.target.value)}
                  placeholder="example.com"
                  className="panel-field"
                />
              </label>
              <button
                type="button"
                className="panel-button self-end"
                onClick={() => void addSiteOverride()}
              >
                {(settings.siteEnabled['*'] ?? false) ? 'Exclude' : 'Allow'}
              </button>
            </div>
            <p className="text-xs leading-5 text-slate-600">
              {(settings.siteEnabled['*'] ?? false)
                ? 'Websites listed below are excluded.'
                : 'Only websites listed below are allowed.'}
            </p>
            <div aria-label="Website rules" className="grid max-h-64 gap-2 overflow-y-auto pr-1">
              {Object.entries(settings.siteEnabled)
                .filter(
                  ([hostname, enabled]) =>
                    hostname !== '*' && enabled !== (settings.siteEnabled['*'] ?? false),
                )
                .map(([hostname, enabled]) => (
                  <div key={hostname} className="setting-row">
                    <span>
                      <strong>{hostname}</strong>
                      <small>{enabled ? 'Allowed' : 'Excluded'}</small>
                    </span>
                    <button
                      type="button"
                      className="panel-button"
                      onClick={() => void removeSiteOverride(hostname)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
            </div>
          </fieldset>
          <label className="grid gap-1 text-sm font-semibold">
            Toolbar position
            <select
              value={settings.toolbarPosition}
              onChange={(event) =>
                void saveSettings({
                  ...settings,
                  toolbarPosition: event.target.value as ExtensionSettings['toolbarPosition'],
                })
              }
              className="panel-field"
            >
              <option value="auto">Auto</option>
              <option value="above">Above</option>
              <option value="below">Below</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Default output format
            <select
              value={settings.defaultOutputFormat}
              onChange={(event) =>
                void saveSettings({
                  ...settings,
                  defaultOutputFormat: event.target
                    .value as ExtensionSettings['defaultOutputFormat'],
                })
              }
              className="panel-field"
            >
              <option value="plain-text">Plain text</option>
              <option value="markdown">Markdown</option>
              <option value="json">JSON</option>
              <option value="yaml">YAML</option>
            </select>
          </label>
          <label className="setting-row">
            <span>Show estimated token count</span>
            <input
              type="checkbox"
              checked={settings.showTokenEstimate}
              onChange={(event) =>
                void saveSettings({ ...settings, showTokenEstimate: event.target.checked })
              }
            />
          </label>
          <label className="setting-row">
            <span>
              <strong>Other compatible editors</strong>
              <small>Show tools beside standard text fields.</small>
            </span>
            <input
              type="checkbox"
              checked={settings.genericEditorFallback}
              onChange={(event) =>
                void saveSettings({ ...settings, genericEditorFallback: event.target.checked })
              }
            />
          </label>
        </section>
      )}

      {section === 'privacy' && (
        <section aria-labelledby="privacy-title" className="mt-5">
          <h2 id="privacy-title" className="font-semibold">
            Privacy
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Privacy information and product support are available from Brownsmith Dynamics.
          </p>
          <a
            href="https://brownsmithdynamics.com"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm font-semibold text-blue-700 underline-offset-2 hover:underline"
          >
            Visit brownsmithdynamics.com
          </a>
        </section>
      )}

      {editing && (
        <div className="fixed inset-0 grid place-items-center bg-slate-950/30 p-3">
          <form
            aria-label="Snippet editor"
            className="max-h-[calc(100vh-24px)] w-full overflow-auto rounded-xl bg-white p-4 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              void saveSnippet(editing);
            }}
          >
            <h2 className="font-semibold">
              {snippets.some((item) => item.id === editing.id) ? 'Edit snippet' : 'Create snippet'}
            </h2>
            {(['name', 'description', 'category'] as const).map((field) => (
              <label key={field} className="mt-3 grid gap-1 text-xs font-semibold capitalize">
                {field}
                <input
                  required={field !== 'category'}
                  value={editing[field] ?? ''}
                  onChange={(event) => setEditing({ ...editing, [field]: event.target.value })}
                  className="panel-field"
                />
              </label>
            ))}
            <label className="mt-3 grid gap-1 text-xs font-semibold">
              Template
              <textarea
                required
                value={editing.template}
                onChange={(event) => setEditing({ ...editing, template: event.target.value })}
                className="min-h-44 rounded-lg border border-slate-300 p-2 font-mono text-xs"
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white"
              >
                Save snippet
              </button>
              <button type="button" className="panel-button" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {notice}
      </div>
    </main>
  );
}
