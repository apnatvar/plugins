export type SafeError = { code: string; message: string; row?: number; field?: string };

export class CsvParseError extends Error {
  readonly code: string;
  readonly row?: number;
  constructor(code: string, message: string, row?: number) {
    super(message); this.name = 'CsvParseError'; this.code = code;
    if (row !== undefined) this.row = row;
  }
}

export class ConversionError extends Error {
  constructor() { super('Value cannot be converted to the declared field type'); this.name = 'ConversionError'; }
}

export class TransformError extends Error {
  constructor() { super('Transform output is invalid for the declared field type'); this.name = 'TransformError'; }
}
