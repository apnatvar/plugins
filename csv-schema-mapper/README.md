# CSV Schema Mapper

Map CSV records into validated JavaScript objects using a small, explicit schema. The package provides a dependency-free parser and serializer, header suggestions, row and stream mapping, and Node.js file helpers.

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE) [![CI](https://img.shields.io/badge/CI-pending%20first%20pushed%20run-lightgrey.svg)](https://github.com/apnatvar/plugins)

The package name is `@brownsmithdynamics/csv-schema-mapper`; the owner confirmed this spelling. The package is unpublished, and npm user `apnatva`'s organization membership and publishing permissions still need owner verification. See [PUBLISHING.md](PUBLISHING.md) before release. This repository is part of [apnatvar/plugins](https://github.com/apnatvar/plugins), maintained by [Brownsmith Dynamics](https://brownsmithdynamics.com).

## Install

Once the first public release is available, install it with:

```sh
npm install @brownsmithdynamics/csv-schema-mapper
```

The package includes an ESM entry point and a Node.js entry point. Import the core API from the package root. Import `mapFile` and `mapFileStream` from the `./node` subpath when working with file paths.

```js
import { createMapper } from '@brownsmithdynamics/csv-schema-mapper';
import { mapFile } from '@brownsmithdynamics/csv-schema-mapper/node';
```

## Quick start

```js
import { createMapper } from '@brownsmithdynamics/csv-schema-mapper';

const schema = {
  name: { type: 'string', required: true, aliases: ['Full Name'] },
  age: { type: 'number' },
  subscribed: { type: 'boolean', emptyValue: 'null', nullable: true },
};

const mapper = createMapper(schema);
const result = mapper.map('Full Name,age,subscribed\nAda Lovelace,36,true');

console.log(result.rows);
// [ { name: 'Ada Lovelace', age: 36, subscribed: true } ]
console.log(result.errors);
// []
console.log(result.mappings);
// Describes which source header was used for each schema field.
```

`map()` returns all successfully mapped rows, mapping metadata, input headers, and row errors. Invalid fields are reported as errors rather than silently converted. Error messages identify the row and field where possible and do not include source cell values.

## Schema fields

Each schema key is an output property. A field definition supports:

| Option | Meaning |
| --- | --- |
| `type` | Required type: `string`, `number`, `boolean`, or `date`. |
| `required` | Require a non-empty value unless nullable empty cells are explicitly mapped to `null`. Defaults to false. |
| `aliases` | Additional source header names for matching. |
| `transform` | Optional function that replaces built-in type conversion. Its return value is used as the output value. |
| `trim` | Trim surrounding whitespace for this field. |
| `nullable` | Permit an empty value to become `null`. |
| `emptyValue` | Choose how an empty cell is represented: `omit`, `null`, or `empty`. |
| `format` | Date output format: `iso` or `date-only`. |

For example:

```js
const schema = {
  email: { type: 'string', required: true, aliases: ['E-mail Address'], trim: true },
  score: { type: 'number', transform: (value) => Number(value.replace('%', '')) },
  active: { type: 'boolean', emptyValue: 'null', nullable: true },
  joined: { type: 'date', format: 'date-only' },
};
```

## Mapping options

Pass options as the second argument to `createMapper(schema, options)`. `mappings` can explicitly select a source header or zero-based header index for an output field. Matching options control case handling, normalization, suggestions, and the minimum suggestion confidence. Duplicate source headers can be rejected or resolved using the first or last occurrence. Unknown source headers can be ignored or treated as errors. Parser limits and `maxErrors` can be set to bound resource use and error volume.

```js
const mapper = createMapper(schema, {
  mappings: { email: 'Contact E-mail' },
  duplicateHeaders: 'error',
  unknownHeaders: 'error',
  maxErrors: 100,
  matching: {
    caseInsensitive: true,
    normalize: true,
    suggestions: true,
    minConfidence: 0.75,
  },
});
```

The complete option and result contracts are documented in [docs/API.md](docs/API.md). See [performance and memory](docs/PERFORMANCE.md) for processing bounds and streaming tradeoffs.

## Streaming

Use `mapStream()` when CSV arrives in chunks or the input is too large to hold as a single string. It accepts an async iterable of strings or `Uint8Array` chunks and yields one result per data row.

```js
async function* chunks() {
  yield 'name,age\nAda,';
  yield '36\nGrace,85\n';
}

const streamMapper = createMapper({ name: { type: 'string' }, age: { type: 'number' } });
for await (const item of streamMapper.mapStream(chunks())) {
  if (item.errors.length) {
    console.error(item.row, item.errors);
  } else {
    console.log(item.data);
  }
}
```

Streaming uses the same schema and mapping options as `map()`. Parser and mapping failures are returned as row errors where a row can be identified. Consult the API reference for the precise handling of fatal parse errors and error limits.

## Utilities

`parseCsv(csv, parserOptions)` parses CSV into `{ values, row }` records. Parser limits default to 50 MiB input, 1 MiB per field, 4 MiB per record, 1,000,000 records, and 10,000 columns. `serializeCsv(rows, options)` serializes objects as CSV, deriving column order from first-seen object keys unless you pass `columns`; output limits are also configurable. Formula protection defaults to `escape` (prefixing formula-looking cells with an apostrophe); it can be set to `reject` to throw on those cells. Spreadsheet behavior varies, so review exported values in the destination application. `suggestMappings(headers, schema, matchingOptions)` proposes source-header matches without mapping data. These utilities are exported from the package root.

For files in Node.js, use `mapFile(path, schema, options)` to map a file into a complete result, or `mapFileStream(path, schema, options)` to stream per-row results. Browser consumers should use the core exports; the `node` subpath depends on Node.js file APIs.

## Security and data handling

Treat CSV data as untrusted input. Configure parser limits for the expected file size and reject unknown or duplicate headers where appropriate. The parser does not execute formulas, and transforms are caller-supplied code; avoid applying untrusted transforms. CSV serialization quotes cells as required by CSV syntax and prefixes formula-looking values by default. Review [SECURITY.md](SECURITY.md) before exporting untrusted data to spreadsheet software.

## Handle errors and export

```js
import { createMapper, serializeCsv } from '@brownsmithdynamics/csv-schema-mapper';

const checked = createMapper({ amount: { type: 'number', required: true } })
  .map('amount\n12.5\nnot-a-number');
console.log(checked.rows); // [{ amount: 12.5 }]
console.log(checked.errors);
// [{ code: 'CONVERSION', message: 'Value cannot be converted to the declared field type',
//    row: 3, field: 'amount' }]
const exported = serializeCsv(checked.rows, { columns: ['amount'], formulaProtection: 'reject' });
console.log(exported); // "amount\r\n12.5"
```

Every rejected row has diagnostics. A terminal `MAX_ERRORS` means processing stopped at the configured error budget; it replaces the final retained diagnostic. Reject an entire application import if `errors.length > 0` when partial acceptance is inappropriate. Streams can emit successful earlier rows before a later error, so stage them when transactional behavior is needed. Schema and mapping configuration errors throw; catch them separately from returned CSV data errors. Dates in `format:'iso'` are `Date` instances, while `date-only` produces `YYYY-MM-DD` strings. Custom transforms replace conversion and must return the declared type.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for local development and release guidance. The package uses Node's built-in test runner; tests are in `tests/`.

## License

MIT. See [LICENSE](LICENSE).
