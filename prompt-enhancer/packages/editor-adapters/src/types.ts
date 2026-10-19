export interface EditorSelection {
  text: string;
  start?: number;
  end?: number;
}

export type EditorInsertMode = 'cursor' | 'replace-selection' | 'append';

export type EditorErrorCode =
  | 'EDITOR_NOT_FOUND'
  | 'UNSUPPORTED_EDITOR'
  | 'READ_FAILED'
  | 'INSERT_FAILED'
  | 'REPLACE_FAILED'
  | 'VERIFICATION_FAILED'
  | 'EDITOR_REMOVED'
  | 'PERMISSION_DENIED';

export class EditorOperationError extends Error {
  constructor(
    readonly code: EditorErrorCode,
    message: string,
    readonly adapterId?: string,
  ) {
    super(message);
    this.name = 'EditorOperationError';
  }
}

export interface EditorAdapter {
  id: string;
  priority: number;
  matchesPage(location: Location, document: Document): boolean;
  findEditor(document: Document): HTMLElement | null;
  isSupportedEditor(element: Element): boolean;
  readText(element: HTMLElement): string;
  replaceText(element: HTMLElement, text: string): Promise<void>;
  insertText(element: HTMLElement, text: string, mode: EditorInsertMode): Promise<void>;
  getSelection(element: HTMLElement): EditorSelection;
  focus(element: HTMLElement): void;
}
