import type * as VSCode from 'vscode';
import { ExtractionResult, planCopyEdits } from './copy';

// Inject the VS Code API so the actual WorkspaceEdit path can be tested in Node.
export async function saveChanges(api: typeof VSCode, snapshot: ExtractionResult, changes: { id: string; text: string }[]): Promise<void> {
  const documents = new Map<string, VSCode.TextDocument>();
  const current: Record<string, string> = {};
  for (const filePath of Object.keys(snapshot.files)) {
    const document = await api.workspace.openTextDocument(api.Uri.file(filePath));
    documents.set(filePath, document);
  }
  // Read all buffers after asynchronous opens, immediately before validation.
  for (const [filePath, document] of documents) current[filePath] = document.getText();
  const replacements = planCopyEdits(snapshot, changes, current);
  if (!replacements.length) return;
  const edit = new api.WorkspaceEdit();
  for (const replacement of replacements) {
    const document = documents.get(replacement.filePath)!;
    edit.replace(document.uri, new api.Range(document.positionAt(replacement.start), document.positionAt(replacement.end)), replacement.text);
  }
  if (!await api.workspace.applyEdit(edit)) throw new Error('VS Code could not apply these changes. Reopen Copy Editor and try again.');
}
