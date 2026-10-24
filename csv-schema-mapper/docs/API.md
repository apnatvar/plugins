# API reference

The package is an ECMAScript module. Core functions are exported from the package root; Node file helpers are exported from the `./node` subpath.

## `createMapper(schema, options?)`

Creates a reusable mapper and returns `{ map(csv), mapStream(chunks) }`.

`schema` is a record whose keys are output property names. Each value is a field definition:

```ts
type Field = {
  type: 'string' | 'number' | 'boolean' | 'date';
  required?: boolean;
  aliases?: string[];
  transform?: (value: string) => unknown;
  trim?: boolean;
  nullable?: boolean;
  emptyValue?: 'omit' | 'null' | 'empty';
  format?: 'iso' | 'date-only';
};
```

Mapper options include:

```ts
type MapperOptions = {
  parser?: ParserOptions;
  matching?: {
    caseInsensitive?: boolean;
    normalize?: boolean;
    suggestions?: boolean;
    minConfidence?: number;
  };
  mappings?: Record<string, string | number>; // Output field -> source header or zero-based index.
  duplicateHeaders?: 'error' | 'first' | 'last';
  unknownHeaders?: 'ignore' | 'error';
  maxErrors?: number;
};
```

Defaults are case-insensitive normalized header matching, no fuzzy suggestions, a suggestion confidence threshold of `0.65`, duplicate-header policy `error`, unknown-header policy `ignore`, and `maxErrors: 1000`. Automatic matching tries an explicit mapping first, then an exact field name, then aliases, then an enabled fuzzy suggestion. Header normalization trims, applies Unicode compatibility normalization (NFKC by default), folds case, and treats whitespace, hyphens, and underscores alike. Set `normalize: false` to retain those separators and use NFC normalization; matching still trims surrounding whitespace. Set `caseInsensitive: false` to preserve case. Prototype-sensitive source headers such as `__proto__`, `prototype`, and `constructor` are reported as `UNSAFE_HEADER`.

`parser` accepts the parser options described below. A field `transform` is invoked by the caller's process for each non-empty mapped value and replaces built-in type conversion: its return value becomes the mapped value. It receives the trimmed raw string unless `trim` is false, and should be treated as trusted code.

String fields are trimmed by default. Empty cells default to `emptyValue: 'omit'`; `emptyValue: 'null'` requires `nullable: true`, and `emptyValue: 'empty'` returns an empty string. `required` rejects empty values when they would otherwise be omitted; explicitly nullable `null` values are accepted. Numbers must be finite, and integers must be safe integers. Booleans accept `true`, `false`, `1`, and `0` (case-insensitive). Dates default to a JavaScript `Date` instance in UTC for strict `YYYY-MM-DD` dates and as parsed from zoned ISO timestamps; `date-only` accepts a strict calendar date and returns its unchanged string. Transform results replace built-in conversion but are validated against the declared field type, including finite and safe numeric values.

### `map(csv)`

Returns:

```ts
type Error = { code: string; message: string; row?: number; field?: string };
type Mapping = {
  field: string;
  column: string | null;
  index: number | null;
  confidence: number;
  method: 'explicit' | 'exact' | 'alias' | 'suggestion' | 'missing';
};
type MappingResult = {
  rows: Record<string, unknown>[];
  errors: Error[];
  mappings: Mapping[];
  headers: string[];
};
```

The first CSV record is treated as the header. `rows` contains successfully converted data records; invalid records are omitted from `rows` and represented in `errors`, so they are not silently discarded. A record with a different number of cells than the header receives `ROW_WIDTH`. `errors` contains safe diagnostic messages and, when known, the source row and output field. The mapper does not include raw source cell contents in errors. If errors exceed `maxErrors`, the last retained error is replaced with a `MAX_ERRORS` marker. `mappings` describes the selected source header for each schema key. `headers` preserves the parsed input header names.

### `mapStream(chunks)`

Accepts an `AsyncIterable<string | Uint8Array>` and returns an async generator. Use one chunk kind consistently for a stream. Each yielded item has the shape `{ row, data, errors }`. `row` identifies the input record, `data` is the mapped object when mapping succeeds, and `errors` contains errors associated with that row. If header setup fails and there are no data rows, the stream yields one row-1 result with `data: null` and the setup errors. Once the error limit is exhausted, the stream emits a terminal `MAX_ERRORS` error and stops consuming input.

## `parseCsv(csv, parserOptions?)`

Parses a CSV string into `Array<{ values: string[]; row: number }>` where `row` is the one-based physical starting line of the record. A quoted record spanning multiple physical lines is attributed to the line where it began. Invalid CSV and configured limit violations raise `CsvParseError` with a `code` and safe `message`. `createMapper().map()` captures parser errors in its result.

Parser options are `delimiter` (default `,`), `quote` (default `"`), and `escape` (default `"`), plus resource limits: `maxInputBytes` (50 MiB), `maxFieldLength` (1 MiB), `maxRecordLength` (4 MiB), `maxRows` (1,000,000), and `maxColumns` (10,000). Limits are configurable for the consuming application. The parser emits blank physical lines as records containing one empty value. Mapping rejects records whose number of columns differs from the header width with `ROW_WIDTH`.

## `serializeCsv(rows, options?)`

Serializes an iterable of object records into CSV text. Rows must be objects with scalar cell values (`string`, finite `number`, `boolean`, `bigint`, `Date`, `null`, or `undefined`). Options are:

```ts
type SerializeOptions = {
  columns?: string[];
  delimiter?: string;
  quote?: string;
  formulaProtection?: 'escape' | 'reject';
  maxRows?: number;
  maxColumns?: number;
  maxFieldLength?: number;
  maxOutputBytes?: number;
};
```

When `columns` is omitted, headers are the first-seen union of object keys; when provided, they set the header order. Empty input returns an empty string unless columns are supplied. Fields containing delimiters, quotes, or line breaks are quoted and embedded quotes are escaped according to CSV rules. Formula protection defaults to `escape`, prefixing cells that begin with formula syntax with an apostrophe; set it to `reject` to throw on such values. Formula protection applies to headers and data cells. Output limits default to 1,000,000 rows, 10,000 columns, 1 MiB per value field, and 50 MiB total output; column names are additionally limited to 512 characters. This is a conservative mitigation and spreadsheet behavior varies by application.

## `suggestMappings(headers, schema, matchingOptions?)`

Returns suggested source-header matches for the schema fields. It accepts the same matching controls (`caseInsensitive`, `normalize`, `suggestions`, and `minConfidence`) used by mapper options. Case-insensitive and normalized matching default to enabled; fuzzy suggestions default to disabled with a minimum confidence of `0.65`. Suggestions are guidance only; pass explicit `mappings` when source-column selection must be deterministic.

## Node.js file helpers

Import from `@brownsmithdynamics/csv-schema-mapper/node`:

```js
import { mapFile, mapFileStream } from '@brownsmithdynamics/csv-schema-mapper/node';
```

`mapFile(path, schema, options?)` maps a file and returns a `MappingResult`. `mapFileStream(path, schema, options?)` returns an async iterable of stream row results. File helpers use Node.js filesystem APIs and are not part of the browser entry point. Files must be UTF-8 (an initial BOM is permitted); malformed bytes fail with `INVALID_UTF8`. Filesystem failures can reject/throw native I/O errors containing the requested path; redact those before exposing them to end users. See [performance and memory](PERFORMANCE.md) for accumulation, backpressure, bounds, and partial-stream behavior.
