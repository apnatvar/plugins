# API reference

All imports are ESM. The package root exports the documented functions and public types. Subpath exports are available for `./parse`, `./normalize`, `./compare`, `./fetch`, and `./report`.

## Main functions

| Export | Behavior |
| --- | --- |
| `parseSitemap(xml, options?)` | Parse Sitemap 0.9 XML into `{ type, entries }`. Does not access the network. |
| `normalizeUrl(input, options?)` | Validate and normalize one absolute HTTP(S) URL. URL credentials and control characters are rejected. |
| `compareSitemaps(before, after, options?)` | Compare arrays of `SitemapEntry` or `ParsedSitemap` values synchronously, using `CompareOptions`. |
| `fetchSitemap(url, options?)` | Fetch one remote HTTP(S) document and return XML text. Does not recursively follow sitemap-index children. |
| `loadSitemap(source, options?)` | Parse one XML string, use already-parsed input, or fetch a URL; recursively load sitemap-index children and return `SitemapEntry[]`. |
| `diffSitemaps(before, after, options?)` | Asynchronously load both sources and compare their entries, returning `Promise<SitemapDiff>`. |
| `toJsonReport(diff, space?)` | Return formatted JSON text. Indentation must be an integer from 0 through 10; default is 2. |
| `toMarkdownReport(diff)` | Return a Markdown report with values escaped for table cells. |

For `loadSitemap` and `diffSitemaps`, a string whose first non-whitespace character is `<` is XML text; another string is treated as an HTTP(S) URL. A UTF-8 BOM at the start also marks XML text. Arrays and parsed `urlset` objects do not trigger network requests. A parsed `sitemapindex` object is expanded by `loadSitemap` and can cause remote child requests; a regular `urlset` never causes its page URLs to be fetched. `compareSitemaps` is synchronous and does not expand sitemap-index references: it compares the `loc` values it is given. The loader accepts only remote HTTP(S) references from an index and never interprets them as filesystem paths.

## Parsing options

`parseSitemap` accepts:

| Option | Default | Meaning |
| --- | ---: | --- |
| `maxBytes` | 5 MiB | Maximum UTF-8 size of XML text. |
| `maxEntries` | 50,000 | Maximum entries in this document. |

The parser also rejects XML nesting deeper than 128 elements. Only UTF-8 sitemap XML with a standard Sitemap 0.9 `urlset` or `sitemapindex` root is accepted. `DOCTYPE` declarations, duplicate supported fields, invalid dates/frequencies/priorities, and missing `loc` values are errors.

## URL normalization options

`NormalizeOptions` is used directly by `normalizeUrl`. `CompareOptions` extends it with a per-side `maxEntries` limit (default 50,000) and is used by `compareSitemaps`. `diffSitemaps` accepts normalization fields under `normalization` and a `maxEntries` limit for loading and comparison.

| Option | Default | Meaning |
| --- | --- | --- |
| `stripHash` | `true` | Remove the fragment before comparison. |
| `stripTrailingSlash` | `false` | Remove trailing path slashes. |
| `sortQuery` | `false` | Sort query parameters. |
| `removeQueryParams` | none | Delete query parameter names supplied in this array. |
| `lowercasePath` | `false` | Lowercase the pathname. |

`CompareOptions.maxEntries` defaults to 50,000 entries on each side. This limit is configurable and independent of loader traversal budgets.

Changing path case, trailing slashes, or query parameters may merge URLs that a site considers distinct. Choose options based on that site's routing rules.

## Loading options and defaults

`LoadOptions` applies to `fetchSitemap`, `loadSitemap`, and `diffSitemaps`. Limits are validated as safe integers. The defaults exported as `DEFAULT_LIMITS` are:

| Option | Default | Meaning |
| --- | ---: | --- |
| `timeoutMs` | 10,000 | Deadline for a remote document request, including DNS and redirects. |
| `maxBytes` | 5 MiB | Maximum raw and expanded bytes for one remote response/document. |
| `maxTotalBytes` | 20 MiB | Maximum decoded XML and parsed-input size in one load traversal. |
| `maxEntries` | 50,000 | Maximum aggregate index references and URL entries accumulated during one load traversal. |
| `maxSitemaps` | 100 | Maximum sitemap documents visited in one traversal. |
| `maxDepth` | 5 | Maximum sitemap-index recursion depth from the root. |
| `maxRedirects` | 3 | Maximum redirects per fetched document. |
| `allowPrivateNetworks` | `false` | Permit requests to local/private addresses when explicitly enabled. |
| `normalization` | `{}` | URL comparison options passed to `compareSitemaps`. |

`fetchSitemap` accepts gzip by `Content-Encoding: gzip` or a `.gz` URL path, and accepts identity encoding. Other encodings fail. Raw and expanded sizes are bounded separately. It uses checked DNS addresses, blocks non-public addresses by default, pins the request to a checked address, and rejects HTTPS-to-HTTP redirects. Enabling `allowPrivateNetworks` applies to all sitemap-index references and redirects.

`loadSitemap` and each side of `diffSitemaps` have independent traversal budgets. For parsed input, the loader counts the UTF-8 size of the sanitized supported JSON shape, including JSON syntax and escaped string values; unknown object properties are discarded. XML markup is absent from parsed values. For example, comparing two remote sitemap indexes can retrieve up to the configured budgets for each side. Add your own overall job timeout and concurrency policy when processing many independent comparisons. The fetch API has no caller-provided header, authentication, or request-hook option.

## Comparison result

`SitemapDiff` contains `added`, `removed`, `changed`, `duplicates`, and `summary`:

- `added` and `removed` contain the first entry for each normalized URL found only on that side.
- `changed` contains one record per URL whose `lastmod`, `changefreq`, or `priority` differs; the `fields` object identifies each changed value.
- `duplicates.before` and `duplicates.after` group repeated normalized URLs and retain all entries in each group. Comparison uses the first entry for each URL.
- `summary.duplicatesBefore` and `summary.duplicatesAfter` count repeated entries beyond the first in each group, not the number of duplicate groups.

`SitemapError` and its subclasses include a stable `code`. The available error classes are `SitemapParseError`, `SitemapValidationError`, `SitemapLimitError`, and `SitemapFetchError`. Codes include `INVALID_INPUT`, `XML_PARSE_ERROR`, `LIMIT_EXCEEDED`, `INVALID_URL`, `FETCH_ERROR`, `UNSAFE_ADDRESS`, `TIMEOUT`, and `CIRCULAR_REFERENCE`.
