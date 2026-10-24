# Sitemap Diff

[![Sitemap Diff CI](https://github.com/apnatvar/plugins/actions/workflows/sitemap-diff.yml/badge.svg?branch=main)](https://github.com/apnatvar/plugins/actions/workflows/sitemap-diff.yml)

Sitemap Diff is a free, MIT-licensed Node.js library and command-line tool by [Brownsmith Dynamics](https://brownsmithdynamics.com) for parsing XML sitemaps and comparing URL collections. It reports added, removed, unchanged, metadata-changed, and duplicate entries, with JSON and Markdown report helpers.

**Status:** unreleased. The package name is proposed as `@brownsmithdynamics/sitemap-diff`; the public API is documented against the current development source. On 2026-10-23, npm returned `E404 Scope not found` for the originally requested `brownmsithdynamics` organization lookup. The corrected `brownsmithdynamics` organization lookup returned an existence response, but publisher membership and package access were not verified. npm returned `E404` for both the originally requested misspelled package and the corrected package name on that date. Confirm publisher access before publication.

## Features

- Parse standard Sitemap 0.9 `urlset` and `sitemapindex` XML.
- Normalize absolute HTTP(S) URLs with explicit options such as sorting query parameters or removing selected parameters.
- Compare `loc` values and detect changes to `lastmod`, `changefreq`, and `priority`.
- Report duplicate normalized URLs on each side of a comparison.
- Traverse remote sitemap indexes with finite request, redirect, document, and aggregate limits.
- Keep ordinary page URLs in a `urlset` as data; the library does not fetch each page URL.
- Run in Node.js 22 or later. The package is ESM-only.

## Installation

The first release has not been published. When the owner verifies and controls the intended package scope, then publishes it, the proposed package command is:

```sh
npm install @brownsmithdynamics/sitemap-diff
```

Until then, clone the repository and work from `sitemap-diff/` at the repository root. Do not rely on the package install command resolving yet.

## Quick start

The following example parses two XML strings and compares them without network access:

```js
import { parseSitemap, compareSitemaps, toJsonReport, toMarkdownReport } from '@brownsmithdynamics/sitemap-diff';

const before = parseSitemap(beforeXml);
const after = parseSitemap(afterXml);
const diff = compareSitemaps(before, after, {
  stripHash: true,
  sortQuery: true,
});

console.log(diff.summary);
console.log(toJsonReport(diff));
console.log(toMarkdownReport(diff));
```

The result has a summary and separate arrays for URL changes and duplicates. A shortened JSON report looks like this:

```json
{
  "added": [{ "loc": "https://example.com/new/" }],
  "removed": [{ "loc": "https://example.com/old/" }],
  "changed": [{
    "url": "https://example.com/guide/",
    "before": { "loc": "https://example.com/guide/", "lastmod": "2026-01-01" },
    "after": { "loc": "https://example.com/guide/", "lastmod": "2026-02-01" },
    "fields": { "lastmod": { "before": "2026-01-01", "after": "2026-02-01" } }
  }],
  "duplicates": { "before": [], "after": [{ "url": "https://example.com/new/", "entries": [{ "loc": "https://example.com/new/" }, { "loc": "https://example.com/new/" }] }] },
  "summary": { "added": 1, "removed": 1, "changed": 1, "unchanged": 0, "duplicatesBefore": 0, "duplicatesAfter": 1 }
}
```

`compareSitemaps` matches entries by normalized `loc`. A URL present on both sides is reported as changed when its `lastmod`, `changefreq`, or `priority` differs. If a normalized URL appears multiple times on one side, the first entry is used for the comparison and the duplicates are reported separately.

## Fetching sitemap documents

`fetchSitemap(url, options)` retrieves one HTTP(S) sitemap document and returns its XML text. `loadSitemap(source, options)` accepts XML text, a parsed sitemap, or an array of entries and returns entries for comparison. For a string source, XML beginning with `<` (or a UTF-8 BOM) is parsed directly; another string is treated as an HTTP(S) sitemap URL. `diffSitemaps(before, after, options)` is asynchronous and loads then compares either source. Only a sitemap index is recursively followed; page URLs from a `urlset` are never crawled. Sitemap-index references are remote HTTP(S) URLs only; the library does not read local paths named in XML.

Network requests are made by the Node.js process using the caller's network access. The defaults are a 10-second timeout, 5 MiB per raw response and decoded document, 20 MiB decoded across a traversal, 50,000 aggregate sitemap-index references and URL entries, 100 sitemap documents, depth 5, and at most 3 redirects. Private and local network addresses are blocked by default; `allowPrivateNetworks` is an explicit opt-in. Review [the security assessment](docs/security-assessment.md) before loading URLs from untrusted sources.

```js
import { diffSitemaps, toMarkdownReport } from '@brownsmithdynamics/sitemap-diff';

const diff = await diffSitemaps(
  'https://www.example.com/sitemap.xml',
  'https://preview.example.com/sitemap.xml',
  { normalization: { sortQuery: true, removeQueryParams: ['utm_source'] } },
);

console.log(toMarkdownReport(diff));
```

Use example domains and public test data in examples. Do not pass confidential or internal URLs to a process that can reach networks you do not intend it to access.

## Command line

The `sitemap-diff` executable accepts two UTF-8 XML files, `.gz` files, or HTTP(S) URLs:

```sh
sitemap-diff ./before.xml ./after.xml --format markdown --output report.md
sitemap-diff https://www.example.com/sitemap.xml https://preview.example.com/sitemap.xml
```

Run `sitemap-diff --help` for supported options. `--allow-private-networks` permits trusted internal destinations and applies to every sitemap-index reference and redirect; use it only for data and networks you control.

## URL normalization

Only absolute HTTP(S) URLs are accepted; URL credentials are rejected. By default, fragments are stripped so `https://example.com/page#section` and `https://example.com/page` compare as the same URL. Other transformations are opt-in:

```js
import { normalizeUrl } from '@brownsmithdynamics/sitemap-diff';

const key = normalizeUrl('https://www.example.com/Guide/?b=2&a=1#top', {
  sortQuery: true,
  stripTrailingSlash: true,
  lowercasePath: true,
  removeQueryParams: ['session'],
});
```

Lowercasing paths or removing query parameters can merge URLs that a site treats as distinct. Choose options to match the site's URL semantics.

## Errors

The library throws `SitemapError` subclasses with a stable `code` for invalid input, invalid URLs, XML parsing, exceeded limits, fetch failures, unsafe addresses, timeouts, and circular sitemap references. Catch errors at the boundary where a URL or document enters your application and present the message without exposing private URLs to public logs.

## Runtime and module format

Node.js 22 or later is required. The package uses native Node.js features and `.js` ESM imports in TypeScript source. It ships ESM only: consumers should use `import` from an ESM module or a compatible dynamic `import()` from CommonJS. A separate CommonJS build is not provided, which avoids publishing two independently generated entry points and their potentially divergent resolution behavior.

## Development

The project is in development. From this directory, install development dependencies and use the package scripts:

```sh
npm install
npm run typecheck
npm run lint
npm run build
npm test
```

Keep generated output and local dependencies out of commits. See [contributing](CONTRIBUTING.md), [changelog](CHANGELOG.md), [security policy](SECURITY.md), and [publishing notes](PUBLISHING.md).

## Privacy

Parsing, normalization, and comparison of supplied strings run locally in the Node.js process. When you call a network-loading API, the process sends HTTP(S) requests to the provided sitemap host and any sitemap-index children it follows. No product backend or telemetry is included. The CLI writes a report only when you provide `--output`; the caller controls that output file. The calling environment, network provider, and requested hosts may process connection metadata under their own practices.

## Limitations

- This is a Node.js 22+ package. Browser runtimes and a separate CommonJS build are not supported.
- XML must use UTF-8 and the Sitemap 0.9 namespace. Foreign namespace extensions are ignored; their metadata is not compared. DTDs and custom entities are rejected.
- `lastmod`, `changefreq`, and `priority` are strings. Comparison detects lexical changes, including equivalent timestamps or priorities written differently. It does not infer moved URLs, redirects, canonical tags, or HTTP page status.
- Native WHATWG URL parsing always canonicalizes hostnames, default ports, and dot segments. Optional path/query transformations can produce additional duplicate groups. Original `loc` strings remain in the result.
- `compareSitemaps` compares the supplied entries synchronously. Use `loadSitemap` or `diffSitemaps` to expand indexes. Repeated child references are fetched once per traversal; ancestor cycles fail.
- Gzip is recognized from `Content-Encoding: gzip` or a `.gz` pathname, with one decompression layer. Other encodings, authentication hooks, custom request headers, and proxies are not provided.
- Reports replace control and bidirectional formatting characters and escape Markdown cells. The structured diff remains the source data; reports are presentation output.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| npm installation returns 404 | The package is unreleased. Build locally and install the generated tarball until publication is verified. |
| `UNSAFE_ADDRESS` | A DNS answer is private, local, or special-use, or a redirect downgrades HTTPS. Internal destinations require an explicit `allowPrivateNetworks: true` for trusted inputs. |
| `XML_PARSE_ERROR` | Check well-formed XML, the standard namespace, UTF-8 encoding, duplicate fields, and forbidden DTDs. |
| `LIMIT_EXCEEDED` | Check per-document and aggregate byte, entry, depth, document, and redirect budgets. Adjust the relevant option for trusted larger inputs. |
| `TIMEOUT` | `timeoutMs` covers DNS, redirects, headers, and the entire response for one document. |
| Import or executable cannot be found | Use Node.js 22+, ESM imports, and run `npm run build` before packing. After installation, use `npx sitemap-diff --help` or the local npm executable. |

See the full [API reference](docs/api.md), [CLI reference](docs/cli.md), and [security assessment](docs/security-assessment.md).

## License

MIT. See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).
