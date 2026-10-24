export type FieldType = 'string' | 'number' | 'boolean' | 'date';
export type FieldSchema = {
  type: FieldType;
  required?: boolean;
  aliases?: string[];
  transform?: (raw: string) => unknown;
  trim?: boolean;
  nullable?: boolean;
  emptyValue?: 'omit' | 'null' | 'empty';
  format?: 'iso' | 'date-only';
};
export type Schema = Record<string, FieldSchema>;
export type ParserOptions = {
  delimiter?: string;
  quote?: string;
  escape?: string;
  maxInputBytes?: number;
  maxFieldLength?: number;
  maxRecordLength?: number;
  maxRows?: number;
  maxColumns?: number;
};
export type MatchingOptions = {
  caseInsensitive?: boolean;
  normalize?: boolean;
  suggestions?: boolean;
  minConfidence?: number;
};
export type MapperOptions = {
  parser?: ParserOptions;
  matching?: MatchingOptions;
  mappings?: Record<string, string | number>;
  duplicateHeaders?: 'error' | 'first' | 'last';
  unknownHeaders?: 'ignore' | 'error';
  maxErrors?: number;
};
export type SafeError = { code: string; message: string; row?: number; field?: string };
export type Mapping = {
  field: string;
  column: string | null;
  index: number | null;
  confidence: number;
  method: 'explicit' | 'exact' | 'alias' | 'suggestion' | 'missing';
};
export type MappingResult = { rows: Record<string, unknown>[]; errors: SafeError[]; mappings: Mapping[]; headers: string[] };
export type RowResult = { row: number; data: Record<string, unknown> | null; errors: SafeError[] };

export const DEFAULT_PARSER_OPTIONS: Required<ParserOptions> = {
  delimiter: ',', quote: '"', escape: '"', maxInputBytes: 50 * 1024 * 1024,
  maxFieldLength: 1024 * 1024, maxRecordLength: 4 * 1024 * 1024, maxRows: 1_000_000, maxColumns: 10_000,
};
