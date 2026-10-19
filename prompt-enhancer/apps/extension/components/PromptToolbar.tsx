import type { ActiveEditor } from '@prompt-composer/editor-adapters';
import { DEFAULT_SETTINGS } from '@prompt-composer/extension-storage';
import {
  DEFAULT_SNIPPETS,
  compilePrompt,
  compressPrompt,
  expandSnippetTemplate,
  lintPrompt,
  parseDraftToPromptSpec,
  structurePrompt,
  estimateApproximateTokens,
  type CompressionLevel,
  type OutputFormat,
  type PromptTransformResult,
} from '@prompt-composer/prompt-core';
import type {
  ExtensionSettings,
  PromptLintCode,
  PromptSnippet,
} from '@prompt-composer/shared-types';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

export interface PromptToolbarProps {
  active: ActiveEditor | null;
  settings?: ExtensionSettings;
  snippets?: PromptSnippet[];
  onPrepareTransform?: (result: PromptTransformResult) => void;
  onConfigureSnippets?: () => Promise<void> | void;
}

type OpenPanel = 'shorten' | 'format' | 'snippets' | 'review' | null;

const undoSnapshots = new WeakMap<HTMLElement, string>();

// Keep the implementation available while these early transform controls are paused.
const TRANSFORM_CONTROLS_ENABLED = false;

const OUTPUT_FORMATS: Array<{ value: OutputFormat; label: string }> = [
  { value: 'plain-text', label: 'Plain text' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
];

function formatFindingCode(code: PromptLintCode): string {
  return code
    .toLowerCase()
    .split('_')
    .map((word) => `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`)
    .join(' ');
}

function isDarkBackground(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;
  while (current) {
    const color = window.getComputedStyle(current).backgroundColor;
    const channels = color.match(/[\d.]+/g)?.map(Number);
    if (color.startsWith('rgb') && channels && channels.length >= 3) {
      const [red = 255, green = 255, blue = 255, alpha = 1] = channels;
      if (alpha >= 0.4) {
        const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
        return luminance < 0.46;
      }
    }
    current = current.parentElement;
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function buildFormatResult(original: string, format: OutputFormat): PromptTransformResult {
  const transformed = compilePrompt(parseDraftToPromptSpec(original), format);
  const originalEstimate = Math.ceil(original.length / 4);
  const transformedEstimate = Math.ceil(transformed.length / 4);
  return {
    original,
    transformed,
    warnings: [],
    removedSegments: [],
    changed: original !== transformed,
    metrics: {
      originalCharacters: original.length,
      transformedCharacters: transformed.length,
      originalApproximateTokens: originalEstimate,
      transformedApproximateTokens: transformedEstimate,
      reductionPercentage: original.length
        ? Math.max(0, Math.round(((original.length - transformed.length) / original.length) * 100))
        : 0,
    },
  };
}

function buildTextResult(
  original: string,
  transformed: string,
  warnings: string[],
): PromptTransformResult {
  return {
    original,
    transformed,
    warnings,
    removedSegments: [],
    changed: original !== transformed,
    metrics: {
      originalCharacters: original.length,
      transformedCharacters: transformed.length,
      originalApproximateTokens: estimateApproximateTokens(original),
      transformedApproximateTokens: estimateApproximateTokens(transformed),
      reductionPercentage: original.length
        ? Math.max(0, Math.round(((original.length - transformed.length) / original.length) * 100))
        : 0,
    },
  };
}

interface PreviewDialogProps {
  result: PromptTransformResult;
  showTokenEstimate: boolean;
  onReplace: () => Promise<void>;
  onInsert: () => Promise<void>;
  onCopy: () => Promise<void>;
  onCancel: () => void;
}

function PreviewDialog({
  result,
  showTokenEstimate,
  onReplace,
  onInsert,
  onCopy,
  onCancel,
}: PreviewDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [
      ...(dialogRef.current?.querySelectorAll<HTMLElement>('button, textarea') ?? []),
    ].filter((element) => !element.hasAttribute('disabled'));
    if (!focusable.length) return;
    const current = focusable.indexOf(document.activeElement as HTMLElement);
    const next = event.shiftKey
      ? (current - 1 + focusable.length) % focusable.length
      : (current + 1) % focusable.length;
    event.preventDefault();
    focusable[next]?.focus();
  };

  return (
    <div
      className="fixed inset-2 z-[2147483001] grid place-items-center bg-slate-950/30"
      data-prompt-composer-ui="true"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pc-preview-title"
        onKeyDown={handleKeyDown}
        className="max-h-[calc(100vh-32px)] w-[min(760px,calc(100vw-32px))] overflow-auto rounded-2xl border border-slate-300 bg-white p-4 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="pc-preview-title" className="text-base font-semibold">
              Review transformation
            </h2>
            {showTokenEstimate && (
              <p className="text-xs text-slate-500">
                Estimated tokens: ~{result.metrics.originalApproximateTokens} to ~
                {result.metrics.transformedApproximateTokens}; {result.metrics.reductionPercentage}%
                reduction
              </p>
            )}
          </div>
          <button type="button" className="pc-button" onClick={onCancel} aria-label="Close preview">
            Cancel
          </button>
        </div>
        {result.warnings.length > 0 && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-2 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
          >
            {result.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold">
            Original prompt
            <textarea
              readOnly
              value={result.original}
              className="min-h-44 resize-y rounded-lg border border-slate-300 bg-slate-50 p-2 font-mono text-xs font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            Transformed prompt
            <textarea
              readOnly
              value={result.transformed}
              className="min-h-44 resize-y rounded-lg border border-slate-300 bg-white p-2 font-mono text-xs font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
        </div>
        {result.removedSegments.length > 0 && (
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer font-semibold">
              Removed segments ({result.removedSegments.length})
            </summary>
            <ul className="mt-1 list-disc pl-5">
              {result.removedSegments.map((segment, index) => (
                <li key={`${segment}-${index}`}>{segment}</li>
              ))}
            </ul>
          </details>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-blue-700 px-3 py-2 font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60"
            onClick={() => void run(onReplace)}
          >
            Replace draft
          </button>
          <button
            type="button"
            disabled={busy}
            className="pc-button border border-slate-300 dark:border-slate-700"
            onClick={() => void run(onInsert)}
          >
            Insert below
          </button>
          <button
            type="button"
            disabled={busy}
            className="pc-button border border-slate-300 dark:border-slate-700"
            onClick={() => void run(onCopy)}
          >
            Copy result
          </button>
          <button type="button" disabled={busy} className="pc-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function PromptToolbar({
  active,
  settings = DEFAULT_SETTINGS,
  snippets: configuredSnippets = DEFAULT_SNIPPETS,
  onPrepareTransform,
  onConfigureSnippets,
}: PromptToolbarProps) {
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [snippetQuery, setSnippetQuery] = useState('');
  const [prepared, setPrepared] = useState<PromptTransformResult | null>(null);
  const [canUndo, setCanUndo] = useState(() =>
    active ? undoSnapshots.has(active.element) : false,
  );
  const [status, setStatus] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !active) return;
    const updatePosition = () => {
      const rect = active.element.getBoundingClientRect();
      const width = Math.min(460, Math.max(280, rect.width));
      const toolbarHeight = toolbarRef.current?.offsetHeight || 40;
      const panel = root.querySelector<HTMLElement>('.pc-panel-upward');
      if (panel) {
        const availablePanelHeight = Math.max(96, window.innerHeight - toolbarHeight - 20);
        panel.style.maxHeight = `${Math.min(320, availablePanelHeight)}px`;
      }
      const panelHeight = panel?.offsetHeight ?? 0;
      root.style.width = `${width}px`;
      root.style.left = `${Math.min(window.innerWidth - width - 8, Math.max(8, rect.left))}px`;
      const above =
        settings.toolbarPosition === 'above' ||
        (settings.toolbarPosition === 'auto' && rect.top > toolbarHeight + 16);
      const preferredTop = above
        ? Math.max(8, rect.top - toolbarHeight - 8)
        : Math.min(window.innerHeight - toolbarHeight - 8, rect.bottom + 8);
      const minimumTop = panelHeight > 0 ? panelHeight + 12 : 8;
      const maximumTop = window.innerHeight - toolbarHeight - 8;
      root.style.top = `${Math.min(maximumTop, Math.max(minimumTop, preferredTop))}px`;
      root.dataset.surface = isDarkBackground(active.element) ? 'dark' : 'light';
    };
    let animationFrame: number | null = null;
    const schedulePositionUpdate = () => {
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        updatePosition();
      });
    };
    updatePosition();
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedulePositionUpdate);
    resizeObserver?.observe(active.element);
    const panel = root.querySelector<HTMLElement>('.pc-panel-upward');
    if (panel) resizeObserver?.observe(panel);
    const themeObserver =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(() => {
            root.dataset.surface = isDarkBackground(active.element) ? 'dark' : 'light';
          });
    let themeElement: HTMLElement | null = active.element;
    while (themeObserver && themeElement) {
      themeObserver.observe(themeElement, {
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
      themeElement = themeElement.parentElement;
    }
    window.addEventListener('resize', schedulePositionUpdate);
    window.addEventListener('scroll', schedulePositionUpdate, true);
    return () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      themeObserver?.disconnect();
      window.removeEventListener('resize', schedulePositionUpdate);
      window.removeEventListener('scroll', schedulePositionUpdate, true);
    };
  }, [active, openPanel, settings.toolbarPosition]);

  const draft = active ? active.adapter.readText(active.element) : '';
  const lint = useMemo(() => lintPrompt(draft), [draft]);
  const snippets = useMemo(() => {
    const query = snippetQuery.trim().toLowerCase();
    return configuredSnippets.filter(
      (snippet) => snippet.enabled && (!query || snippet.name.toLowerCase().includes(query)),
    );
  }, [configuredSnippets, snippetQuery]);

  if (!active) return null;
  const readCurrentDraft = () => active.adapter.readText(active.element);

  const prepare = (result: PromptTransformResult) => {
    setPrepared(result);
    setOpenPanel(null);
    onPrepareTransform?.(result);
  };

  const applyResult = async (mode: 'replace' | 'append') => {
    if (!prepared) return;
    const original = active.adapter.readText(active.element);
    undoSnapshots.set(active.element, original);
    try {
      if (mode === 'replace')
        await active.adapter.replaceText(active.element, prepared.transformed);
      else await active.adapter.insertText(active.element, prepared.transformed, 'append');
      setCanUndo(true);
      setPrepared(null);
      setStatus(
        mode === 'replace'
          ? 'Draft replaced. Undo is available.'
          : 'Result inserted below. Undo is available.',
      );
    } catch (error) {
      undoSnapshots.delete(active.element);
      setStatus(error instanceof Error ? error.message : 'The editor could not be updated.');
    }
  };

  const undo = async () => {
    const snapshot = undoSnapshots.get(active.element);
    if (snapshot === undefined) return;
    try {
      await active.adapter.replaceText(active.element, snapshot);
      undoSnapshots.delete(active.element);
      setCanUndo(false);
      setStatus('The previous draft was restored.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Undo failed.');
    }
  };

  const prepareSnippet = (snippet: (typeof DEFAULT_SNIPPETS)[number]) => {
    const currentDraft = readCurrentDraft();
    const selection = active.adapter.getSelection(active.element).text;
    const expansion = expandSnippetTemplate(snippet.template, {
      selection,
      current_prompt: currentDraft,
      page_title: document.title,
      page_url: window.location.href,
      date: new Date().toISOString().slice(0, 10),
    });
    prepare(buildTextResult(currentDraft, expansion.text, expansion.warnings));
  };

  const handleToolbarKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      setOpenPanel(null);
      active.adapter.focus(active.element);
      return;
    }
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const buttons = [
      ...(toolbarRef.current?.querySelectorAll<HTMLButtonElement>(':scope > button') ?? []),
    ];
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    buttons[(current + direction + buttons.length) % buttons.length]?.focus();
  };

  return (
    <div
      ref={rootRef}
      data-prompt-composer-ui="true"
      data-theme="adaptive"
      data-surface="light"
      className="pc-floating-root fixed z-[2147483000] text-[13px] leading-5"
    >
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label="Prompt Composer tools"
        onKeyDown={handleToolbarKeyDown}
        className="pc-toolbar-surface inline-flex max-w-full items-center gap-1 rounded-xl p-1.5"
      >
        {TRANSFORM_CONTROLS_ENABLED && (
          <>
            <button
              type="button"
              className="pc-button"
              onClick={() => prepare(structurePrompt(readCurrentDraft()))}
            >
              Structure
            </button>
            <button
              type="button"
              className="pc-button"
              aria-expanded={openPanel === 'shorten'}
              onClick={() => setOpenPanel(openPanel === 'shorten' ? null : 'shorten')}
            >
              Shorten
            </button>
          </>
        )}
        <button
          type="button"
          className="pc-button"
          aria-expanded={openPanel === 'format'}
          onClick={() => setOpenPanel(openPanel === 'format' ? null : 'format')}
        >
          Format
        </button>
        <button
          type="button"
          className="pc-button"
          aria-expanded={openPanel === 'snippets'}
          onClick={() => setOpenPanel(openPanel === 'snippets' ? null : 'snippets')}
        >
          Snippets
        </button>
        <button
          type="button"
          className="pc-button"
          aria-expanded={openPanel === 'review'}
          onClick={() => setOpenPanel(openPanel === 'review' ? null : 'review')}
        >
          Review
          {lint.findings.length > 0 && (
            <span className="pc-review-count ml-1 rounded-full px-1.5 text-[11px]">
              {lint.findings.length}
            </span>
          )}
        </button>
        {canUndo && (
          <button
            type="button"
            className="pc-button text-blue-700 dark:text-blue-300"
            onClick={() => void undo()}
          >
            Undo
          </button>
        )}
      </div>

      {openPanel && (
        <div
          data-panel-placement="above"
          className="pc-panel-surface pc-panel-upward max-h-80 overflow-auto rounded-xl p-3"
        >
          {TRANSFORM_CONTROLS_ENABLED && openPanel === 'shorten' && (
            <div role="menu" aria-label="Compression level" className="grid gap-1">
              {(['light', 'balanced', 'aggressive'] as CompressionLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  role="menuitem"
                  className="pc-menu-item capitalize"
                  onClick={() => prepare(compressPrompt(readCurrentDraft(), level))}
                >
                  {level}
                  {level === settings.compressionDefault && (
                    <span className="ml-1 text-[11px] text-slate-500">Default</span>
                  )}
                  {level === 'aggressive' && (
                    <span className="block text-[11px] text-amber-700 dark:text-amber-300">
                      Potentially lossy
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {openPanel === 'format' && (
            <div role="menu" aria-label="Output format" className="grid gap-1">
              {OUTPUT_FORMATS.map((format) => (
                <button
                  key={format.value}
                  type="button"
                  role="menuitem"
                  className="pc-menu-item"
                  onClick={() => prepare(buildFormatResult(readCurrentDraft(), format.value))}
                >
                  {format.label}
                  {format.value === settings.defaultOutputFormat && (
                    <span className="ml-1 text-[11px] text-slate-500">Default</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {openPanel === 'snippets' && (
            <div>
              <label htmlFor="pc-snippet-search" className="sr-only">
                Search snippets
              </label>
              <input
                id="pc-snippet-search"
                value={snippetQuery}
                onChange={(event) => setSnippetQuery(event.target.value)}
                placeholder="Search snippets"
                className="w-full rounded-lg border border-slate-300 bg-transparent px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-600"
              />
              <div
                role="listbox"
                aria-label="Snippet commands"
                className="pc-snippet-list mt-2 grid gap-1 pr-1"
              >
                {snippets.map((snippet) => (
                  <button
                    key={snippet.id}
                    type="button"
                    role="option"
                    aria-selected="false"
                    className="pc-menu-item"
                    onClick={() => prepareSnippet(snippet)}
                  >
                    <span>{snippet.name}</span>
                  </button>
                ))}
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="pc-configure-snippets pc-menu-item"
                  onClick={() => {
                    setOpenPanel(null);
                    void Promise.resolve(onConfigureSnippets?.())
                      .then(() => setStatus('Snippet settings opened.'))
                      .catch(() => setStatus('Snippet settings could not be opened.'));
                  }}
                >
                  <span className="font-semibold">Configure snippets</span>
                  <span className="pc-secondary-text ml-2 text-[11px]">Add, edit or delete</span>
                </button>
              </div>
            </div>
          )}
          {openPanel === 'review' && (
            <section aria-label="Prompt review">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-semibold">Prompt review</h2>
                <p className="pc-secondary-text text-[11px]">
                  {lint.metrics.words} words
                  {settings.showTokenEstimate && ` · ~${lint.metrics.approximateTokens} tokens`}
                </p>
              </div>
              {lint.findings.length === 0 ? (
                <p className="mt-2 text-emerald-700">No deterministic findings.</p>
              ) : (
                <div className="mt-2 grid gap-2">
                  {lint.findings.map((finding, index) => (
                    <details className="pc-review-item" key={`${finding.code}-${index}`}>
                      <summary className="pc-review-summary">
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">
                            {formatFindingCode(finding.code)}
                          </span>
                          <span className="pc-secondary-text block truncate text-[11px]">
                            {finding.message}
                          </span>
                        </span>
                        <span className="pc-severity-badge" data-severity={finding.severity}>
                          {finding.severity}
                        </span>
                        <span className="pc-review-chevron" aria-hidden="true">
                          ›
                        </span>
                      </summary>
                      <div className="pc-review-body">
                        <p>{finding.message}</p>
                        {finding.suggestion && (
                          <div className="pc-solution">
                            <p className="text-[11px] font-semibold uppercase tracking-wide">
                              Possible solution
                            </p>
                            <p className="mt-0.5">{finding.suggestion}</p>
                          </div>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
      {prepared && (
        <PreviewDialog
          result={prepared}
          showTokenEstimate={settings.showTokenEstimate}
          onReplace={() => applyResult('replace')}
          onInsert={() => applyResult('append')}
          onCopy={async () => {
            await navigator.clipboard.writeText(prepared.transformed);
            setStatus('Result copied to the clipboard.');
          }}
          onCancel={() => {
            setPrepared(null);
            active.adapter.focus(active.element);
          }}
        />
      )}
      <div role="status" aria-live="polite" className="sr-only">
        {status}
      </div>
    </div>
  );
}
