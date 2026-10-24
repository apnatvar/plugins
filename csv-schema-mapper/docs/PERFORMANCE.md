# Performance and memory

The runtime has no dependencies, network calls, recursion over CSV data, or AI inference. Parsing scans characters with bounded field and record state. Header matching runs once per input; exact/alias matching uses normalized header indexes, while opt-in edit-distance suggestions use bounded dynamic programming.

## Choosing an entry point

`map(string)` and `parseCsv(string)` retain parsed records. `map()` also retains successful objects and diagnostics. Their peak heap can be several times the UTF-8 input size because JavaScript strings, arrays, keys, output objects, and temporary arrays consume additional memory. The 50 MiB default input cap is a data bound, **not** a 50 MiB heap guarantee. For small request limits, set a substantially smaller cap at the application boundary.

`mapFile()` reads the requested file in 64 KiB chunks, enforces the byte limit during reading, then retains bytes, decoded text, parsed records, and output. It avoids trusting a file-size stat before reading, but is an accumulating convenience API. Use `mapFileStream()` for larger files.

`mapStream()` and `mapFileStream()` emit rows as records finish. The library retains the current field/record and fixed header/mapping state. The upstream producer still owns each provided chunk, and the consumer controls whether yielded outputs accumulate. Use moderately sized chunks (for example 64 KiB) and process each result before requesting the next. A producer can allocate a huge chunk before handing it to the library; library limits cannot undo that allocation. Async iteration provides backpressure between results. Cancellation closes the iterator and Node file helper streams are destroyed in `finally`.

`serializeCsv()` returns one complete string. It accumulates the supplied rows to infer first-seen union columns, then builds output under explicit limits. It is bounded but is not a streaming writer. Application-supplied iterables, transforms, getters, and callbacks remain trusted code; their own CPU, memory, and I/O are outside library limits.

## Bounds

| Resource | Default / fixed bound |
| --- | --- |
| Parser UTF-8 input bytes | 50 MiB, configurable |
| Parser field / raw record length | 1 Mi / 4 Mi UTF-16 code units, configurable |
| Parser records, including header | 1,000,000, configurable |
| Parser columns | 10,000, configurable |
| Retained errors | 1,000, configurable; terminal `MAX_ERRORS` stops mapping |
| Schema fields / aliases per field | 1,000 / 100 |
| Matching field/header/alias name | 512 UTF-16 code units |
| Header count × schema field count | 1,000,000 |
| Fuzzy header/alias pair candidates per field | 2,048 |
| Fuzzy compared name length | 128 code units; longer names get exact/alias matching only |
| Fuzzy total dynamic-programming cells | 2,000,000 per matching operation |
| Serializer rows / columns | 1,000,000 / 10,000, configurable |
| Serializer value length / header length | 1 Mi configurable / at most 512 code units |
| Serializer UTF-8 output bytes | 50 MiB, configurable |

Increasing configured bounds increases resource consumption. Fuzzy workload violations throw rather than silently applying partial suggestions. For wide schemas, prefer reviewed explicit mappings and leave suggestions disabled. Null, omission, trimming, and numeric/date conversions are deterministic; JavaScript numbers still use binary floating-point arithmetic. Keep identifiers and exact financial decimals as strings or supply a reviewed transformation to a supported output type.

## Error and streaming behavior

Limits have stable error codes. Invalid data rows have `data:null` and structured diagnostics; successful rows contain the whole validated record. `map()` parses the complete string before mapping, so a syntax failure returns no mapped rows. Streams can have emitted valid earlier records before a later parse failure. Consumers needing all-or-nothing imports must stage their own results and commit only after successful exhaustion with no errors.

Header/mapping metadata and successful output can contain sensitive input. Even though cell values and callback exception details are excluded from error messages, schema field names and metadata are not anonymized. Do not log them indiscriminately. No synthetic benchmark is a guarantee of throughput or heap use on arbitrary CSV shapes; size representative records and enforce timeouts outside the library for hostile workloads.
