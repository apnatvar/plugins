import { DEFAULT_PARSER_OPTIONS, type ParserOptions } from './types.js';
import { CsvParseError } from './errors.js';
export { CsvParseError } from './errors.js';

export type CsvRecord = { values: string[]; row: number };
function strictStringBytes(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new CsvParseError('INVALID_UTF8', 'CSV input contains an invalid Unicode sequence');
      i++; bytes += 4;
    } else if (code >= 0xdc00 && code <= 0xdfff) throw new CsvParseError('INVALID_UTF8', 'CSV input contains an invalid Unicode sequence');
    else bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : 3;
  }
  return bytes;
}

function settings(options: ParserOptions = {}) {
  const o = { ...DEFAULT_PARSER_OPTIONS, ...options };
  for (const [key, value] of Object.entries({ delimiter: o.delimiter, quote: o.quote, escape: o.escape })) {
    if (typeof value !== 'string' || value.length !== 1 || value === '\r' || value === '\n' || (value.charCodeAt(0) >= 0xd800 && value.charCodeAt(0) <= 0xdfff)) throw new CsvParseError('INVALID_OPTIONS', `${key} must be one non-newline Unicode character`);
  }
  for (const [key, value] of Object.entries({ maxInputBytes: o.maxInputBytes, maxFieldLength: o.maxFieldLength, maxRecordLength: o.maxRecordLength, maxRows: o.maxRows, maxColumns: o.maxColumns })) {
    if (!Number.isSafeInteger(value) || value < 1) throw new CsvParseError('INVALID_OPTIONS', `${key} must be a positive safe integer`);
  }
  if (o.delimiter === o.quote || o.escape === o.delimiter) throw new CsvParseError('INVALID_OPTIONS', 'CSV delimiter, quote, and escape settings conflict');
  return o;
}

class CsvParser {
  private opts: ReturnType<typeof settings>;
  private field = ''; private values: string[] = []; private quoted = false; private closedQuote = false;
  private recordLength = 0; private row = 1; private recordRow = 1; private rows = 0; private pendingCR = false; private pendingCRInside = false; private first = true; private ended = false; private carry = '';
  constructor(options: ParserOptions = {}) { this.opts = settings(options); }
  push(text: string): Generator<CsvRecord> {
    if (this.ended) throw new CsvParseError('PARSER_STATE', 'Cannot add input after parser completion');
    text = this.carry + text; this.carry = '';
    return this.process(text);
  }
  private *process(text: string, final = false): Generator<CsvRecord> {
    for (let i = 0; i < text.length; i++) {
      const c = text[i]!;
      if (this.first) { this.first = false; if (c === '\uFEFF') continue; }
      if (this.pendingCR) {
        this.pendingCR = false;
        if (c === '\n') {
          if (this.pendingCRInside) {
            this.recordLength++;
            if (this.recordLength > this.opts.maxRecordLength) throw new CsvParseError('MAX_RECORD_LENGTH', 'CSV record exceeds the configured size limit', this.recordRow);
            this.field += '\n'; this.checkField();
          }
          this.pendingCRInside = false;
          continue;
        }
        this.pendingCRInside = false;
      }
      this.recordLength++;
      if (this.recordLength > this.opts.maxRecordLength) throw new CsvParseError('MAX_RECORD_LENGTH', 'CSV record exceeds the configured size limit', this.recordRow);
      if (this.quoted) {
        if (this.opts.escape !== this.opts.quote && c === this.opts.escape) {
          const next = text[i + 1];
          if (next === undefined && !final) { this.carry = c; this.recordLength--; continue; }
          if (next === undefined) { this.field += c; this.checkField(); continue; }
          if (next === this.opts.quote || next === this.opts.escape) { this.recordLength++; if (this.recordLength > this.opts.maxRecordLength) throw new CsvParseError('MAX_RECORD_LENGTH', 'CSV record exceeds the configured size limit', this.recordRow); this.field += next; i++; this.checkField(); continue; }
          this.field += c; this.checkField(); continue;
        }
        if (c === this.opts.quote) {
          if (this.opts.escape === this.opts.quote && text[i + 1] === undefined && !final) { this.carry = c; this.recordLength--; continue; }
          if (this.opts.escape === this.opts.quote && text[i + 1] === this.opts.quote) { this.recordLength++; if (this.recordLength > this.opts.maxRecordLength) throw new CsvParseError('MAX_RECORD_LENGTH', 'CSV record exceeds the configured size limit', this.recordRow); this.field += c; i++; this.checkField(); }
          else { this.quoted = false; this.closedQuote = true; }
        } else {
          this.field += c; this.checkField();
          if (c === '\n') this.row++;
          else if (c === '\r') { this.row++; this.pendingCR = true; this.pendingCRInside = true; }
        }
        continue;
      }
      if (this.closedQuote && c !== this.opts.delimiter && c !== '\r' && c !== '\n') throw new CsvParseError('INVALID_QUOTE', 'Unexpected character after a quoted CSV field', this.recordRow);
      if (c === this.opts.delimiter) { this.finishField(); continue; }
      if (c === '\r' || c === '\n') {
        this.finishField(); yield this.finishRecord();
        if (c === '\r') { this.pendingCR = true; this.row++; } else this.row++;
        this.recordRow = this.row; continue;
      }
      if (c === this.opts.quote) {
        if (this.field.length !== 0 || this.closedQuote) throw new CsvParseError('INVALID_QUOTE', 'Quote may only begin a CSV field', this.recordRow);
        this.quoted = true; continue;
      }
      this.field += c; this.checkField();
    }
  }
  finish(): Generator<CsvRecord> {
    this.ended = true;
    return this.finishRecords();
  }
  private *finishRecords(): Generator<CsvRecord> {
    const carry = this.carry; this.carry = '';
    yield* this.process(carry, true);
    if (this.quoted) throw new CsvParseError('UNTERMINATED_QUOTE', 'CSV input ends inside a quoted field', this.recordRow);
    if (this.recordLength === 0 && this.field.length === 0 && this.values.length === 0 && !this.closedQuote) return;
    this.finishField(); yield this.finishRecord();
  }
  private checkField() { if (this.field.length > this.opts.maxFieldLength) throw new CsvParseError('MAX_FIELD_LENGTH', 'CSV field exceeds the configured size limit', this.recordRow); }
  private finishField() {
    this.values.push(this.field); this.field = ''; this.closedQuote = false;
    if (this.values.length > this.opts.maxColumns) throw new CsvParseError('MAX_COLUMNS', 'CSV record has too many columns', this.recordRow);
  }
  private finishRecord(): CsvRecord {
    const result = { values: this.values, row: this.recordRow };
    this.values = []; this.recordLength = 0; this.rows++;
    if (this.rows > this.opts.maxRows) throw new CsvParseError('MAX_ROWS', 'CSV input has too many records', result.row);
    return result;
  }
}

export function parseCsv(csv: string, options?: ParserOptions): CsvRecord[] {
  if (typeof csv !== 'string') throw new CsvParseError('INVALID_INPUT', 'CSV input must be a string');
  const opts = settings(options);
  if (strictStringBytes(csv) > opts.maxInputBytes) throw new CsvParseError('MAX_INPUT_BYTES', 'CSV input exceeds the configured size limit');
  const parser = new CsvParser(opts);
  return [...parser.push(csv), ...parser.finish()];
}

export async function* parseCsvStream(input: AsyncIterable<string | Uint8Array>, options?: ParserOptions): AsyncGenerator<CsvRecord> {
  const opts = settings(options), parser = new CsvParser(opts), decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  let bytes = 0, chunkKind: 'string' | 'bytes' | undefined, pendingHighSurrogate = '';
  try {
    for await (const chunk of input) {
      if (typeof chunk === 'string') {
        if (chunkKind === 'bytes') throw new CsvParseError('INVALID_INPUT', 'String and byte chunks cannot be mixed in one CSV stream');
        chunkKind = 'string';
        let text = pendingHighSurrogate + chunk; pendingHighSurrogate = '';
        if (text.length && text.charCodeAt(text.length - 1) >= 0xd800 && text.charCodeAt(text.length - 1) <= 0xdbff) { pendingHighSurrogate = text.at(-1)!; text = text.slice(0, -1); }
        bytes += strictStringBytes(text);
        if (bytes > opts.maxInputBytes) throw new CsvParseError('MAX_INPUT_BYTES', 'CSV input exceeds the configured size limit');
        for (const rec of parser.push(text)) yield rec;
      } else if (chunk instanceof Uint8Array) {
        if (chunkKind === 'string') throw new CsvParseError('INVALID_INPUT', 'String and byte chunks cannot be mixed in one CSV stream');
        chunkKind = 'bytes';
        bytes += chunk.byteLength;
        if (bytes > opts.maxInputBytes) throw new CsvParseError('MAX_INPUT_BYTES', 'CSV input exceeds the configured size limit');
        const decoded = decoder.decode(chunk, { stream: true });
        for (const rec of parser.push(decoded)) yield rec;
      } else throw new CsvParseError('INVALID_INPUT', 'Stream chunks must be strings or Uint8Array values');
    }
    if (pendingHighSurrogate) throw new CsvParseError('INVALID_UTF8', 'CSV input contains an invalid Unicode sequence');
    const rest = decoder.decode();
    for (const rec of parser.push(rest)) yield rec;
    for (const rec of parser.finish()) yield rec;
  } catch (error) {
    if (error instanceof CsvParseError) throw error;
    if (error instanceof TypeError) throw new CsvParseError('INVALID_UTF8', 'CSV stream contains invalid UTF-8 data');
    throw error;
  }
}
