export type SerializeOptions = {
  columns?: string[]; delimiter?: string; quote?: string; formulaProtection?: 'escape' | 'reject';
  maxRows?: number; maxColumns?: number; maxFieldLength?: number; maxOutputBytes?: number;
};
// eslint-disable-next-line no-control-regex -- Control characters are included to detect spreadsheet formula prefixes after tabs and line controls.
const DANGEROUS_FORMULA = /^[\s\u0000-\u0020\u007f-\u009f\u00a0\u2000-\u200f\u2028\u2029\u202f\u205f\u3000\ufeff]*[=+\-@＝＋－＠]/u;
function cell(value: unknown, delimiter: string, quote: string, protection: SerializeOptions['formulaProtection']): string {
  let text = value == null ? '' : value instanceof Date ? value.toISOString() : String(value);
  protection ??= 'escape';
  if (DANGEROUS_FORMULA.test(text)) {
    if (protection === 'reject') throw new TypeError('CSV cell begins with a formula expression');
    if (protection === 'escape') text = `'${text}`;
  }
  if (text.includes(quote) || text.includes(delimiter) || /[\r\n]/.test(text)) return quote + text.split(quote).join(quote + quote) + quote;
  return text;
}
export function serializeCsv(rows: Iterable<Record<string, unknown>>, options: SerializeOptions = {}): string {
  const delimiter = options.delimiter ?? ',', quote = options.quote ?? '"';
  if (delimiter.length !== 1 || quote.length !== 1 || delimiter === quote || /[\r\n]/.test(delimiter + quote)) throw new TypeError('delimiter and quote must be distinct single characters');
  if (options.formulaProtection !== undefined && !['escape', 'reject'].includes(options.formulaProtection)) throw new TypeError('Invalid formulaProtection option');
  const maxRows = options.maxRows ?? 1_000_000, maxColumns = options.maxColumns ?? 10_000;
  const maxFieldLength = options.maxFieldLength ?? 1_048_576, maxOutputBytes = options.maxOutputBytes ?? 50 * 1024 * 1024;
  for (const [key, value] of Object.entries({ maxRows, maxColumns, maxFieldLength, maxOutputBytes })) if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${key} must be a positive safe integer`);
  const list: Record<string, unknown>[] = [], inferred = new Set<string>();
  let estimatedBytes = 0;
  for (const row of rows) {
    if (list.length >= maxRows) throw new RangeError('CSV output exceeds the row limit');
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new TypeError('Each CSV row must be an object');
    const keys = Object.keys(row);
    if (keys.length > maxColumns) throw new RangeError('CSV output exceeds the column limit');
    for (const key of keys) inferred.add(key);
    if (inferred.size > maxColumns) throw new RangeError('CSV output exceeds the column limit');
    for (const value of Object.values(row)) {
      const text = scalarText(value);
      if (text.length > maxFieldLength) throw new RangeError('CSV output contains an oversized field');
      estimatedBytes += new TextEncoder().encode(text).byteLength;
      if (estimatedBytes > maxOutputBytes) throw new RangeError('CSV output exceeds the size limit');
    }
    list.push(row);
  }
  const columns = options.columns ? [...options.columns] : [...inferred];
  if (columns.length > maxColumns || columns.some(c => typeof c !== 'string' || c.length > Math.min(maxFieldLength, 512))) throw new RangeError('CSV output exceeds the column or field limit');
  if (!columns.length) return '';
  const lines: string[] = [];
  let outputBytes = 0;
  const headerCells: string[] = [];
  for (const column of columns) {
    const value = cell(column, delimiter, quote, options.formulaProtection);
    outputBytes += new TextEncoder().encode(value).byteLength + (headerCells.length ? new TextEncoder().encode(delimiter).byteLength : 0);
    if (outputBytes > maxOutputBytes) throw new RangeError('CSV output exceeds the size limit');
    headerCells.push(value);
  }
  lines.push(headerCells.join(delimiter));
  for (const row of list) {
    const rowCells: string[] = [];
    for (const key of columns) {
      const value = cell(Object.prototype.hasOwnProperty.call(row, key) ? row[key] : undefined, delimiter, quote, options.formulaProtection);
      outputBytes += new TextEncoder().encode(value).byteLength + (rowCells.length ? new TextEncoder().encode(delimiter).byteLength : 0);
      if (outputBytes > maxOutputBytes) throw new RangeError('CSV output exceeds the size limit');
      rowCells.push(value);
    }
    outputBytes += 2;
    if (outputBytes > maxOutputBytes) throw new RangeError('CSV output exceeds the size limit');
    const line = rowCells.join(delimiter);
    lines.push(line);
  }
  return lines.join('\r\n');
}

function scalarText(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new TypeError('Invalid Date value');
    return value.toISOString();
  }
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  throw new TypeError('CSV cells must contain scalar values');
}
