import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import * as path from 'node:path';
import { extractCopy, ExtractionResult } from './copy';
import { saveChanges } from './save';

export function activate(context: vscode.ExtensionContext): void {
  let panel: vscode.WebviewPanel | undefined;
  context.subscriptions.push(vscode.commands.registerCommand('copyEditor.open', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== 'file' || !/\.(jsx|tsx)$/i.test(editor.document.fileName)) {
      void vscode.window.showInformationMessage('Open a local .jsx or .tsx file first.');
      return;
    }
    panel?.dispose();
    const entryFile = editor.document.fileName;
    const view = vscode.window.createWebviewPanel('copyEditor', 'Copy Editor', vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [] });
    panel = view;
    let snapshot: ExtractionResult;
    let busy = false;
    const refresh = async () => {
      snapshot = await extractCopy({ entryFile, readFile: async filePath => {
        // Includes unsaved editor contents; this extension never saves files to disk.
        try { return (await vscode.workspace.openTextDocument(vscode.Uri.file(filePath))).getText(); }
        catch { return undefined; }
      } });
      view.webview.html = render(snapshot, entryFile);
    };
    view.onDidDispose(() => { if (panel === view) panel = undefined; }, undefined, context.subscriptions);
    view.webview.onDidReceiveMessage(async message => {
      if (busy || message?.type !== 'save' || !Array.isArray(message.changes)) return;
      if (!message.changes.every((item: unknown) => typeof item === 'object' && item !== null && typeof (item as any).id === 'string' && typeof (item as any).text === 'string')) return;
      busy = true;
      try {
        await saveChanges(vscode, snapshot, message.changes);
        await refresh();
      } catch (error) {
        void vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Could not save copy changes.');
        await view.webview.postMessage({ type: 'ready' });
      } finally { busy = false; }
    }, undefined, context.subscriptions);
    try { await refresh(); }
    catch (error) { view.dispose(); void vscode.window.showErrorMessage(String(error)); }
  }));
  context.subscriptions.push({ dispose: () => panel?.dispose() });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function render(snapshot: ExtractionResult, entryFile: string): string {
  const nonce = randomBytes(18).toString('hex');
  const groups = new Map<string, typeof snapshot.items>();
  for (const item of snapshot.items) {
    const group = groups.get(item.filePath);
    if (group) group.push(item);
    else groups.set(item.filePath, [item]);
  }
  const fields = [...groups].map(([filePath, items]) => {
    const label = vscode.workspace.asRelativePath(filePath, false) || path.basename(filePath);
    const entries = items.map(item => {
      const source = snapshot.files[item.filePath] ?? '';
      const contentStart = item.start + (item.original.match(/^[ \t\r\n]*/)?.[0].length ?? 0);
      const line = source.slice(0, contentStart).split(/\r\n|\n|\r/).length;
      return `<label><span>Line ${line}</span><textarea data-id="${escapeHtml(item.id)}" rows="${Math.min(8, Math.max(2, item.text.split('\n').length))}">${escapeHtml(item.text)}</textarea></label>`;
    }).join('');
    return `<section><h2>${escapeHtml(label)}</h2>${entries}</section>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';"><title>Copy Editor</title><style nonce="${nonce}">
  body { padding: 16px; color: var(--vscode-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); }
  section { margin: 0 0 24px; padding: 14px; border: 1px solid var(--vscode-panel-border, var(--vscode-input-border, transparent)); border-radius: 4px; } h2 { margin: 0 0 14px; font-size: 1.15em; font-weight: 600; overflow-wrap: anywhere; } label { display: block; margin: 0 0 18px; } label:last-child { margin-bottom: 0; } span, p { color: var(--vscode-descriptionForeground); } span { display: block; margin-bottom: 5px; font-size: 11px; overflow-wrap: anywhere; }
  textarea { box-sizing: border-box; width: 100%; resize: vertical; font: inherit; line-height: 1.5; padding: 8px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent); }
  textarea:focus, button:focus { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }
  footer { position: sticky; bottom: 0; padding: 12px 0; background: var(--vscode-editor-background); } button { cursor: pointer; border: 0; padding: 8px 14px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); } button:hover { background: var(--vscode-button-hoverBackground); } button:disabled { opacity: .6; }
  </style></head><body><p>${escapeHtml(path.basename(entryFile))} · Static JSX order</p>${fields || '<p>No supported static JSX text found.</p>'}${snapshot.items.length ? '<footer><button id="save">Save Changes</button></footer>' : ''}<script nonce="${nonce}">
  const api = acquireVsCodeApi(); const button = document.getElementById('save');
  if (button) button.addEventListener('click', () => { button.disabled = true; api.postMessage({ type: 'save', changes: Array.from(document.querySelectorAll('textarea')).map(field => ({id: field.dataset.id, text: field.value})) }); });
  window.addEventListener('message', event => { if (event.data.type === 'ready' && button) button.disabled = false; });
  </script></body></html>`;
}
