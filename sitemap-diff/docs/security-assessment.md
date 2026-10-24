# Security assessment

**Review date:** 2026-10-23  
**Status:** development review; repeat against the release artifact before publication.

## Scope and data flow

Sitemap Diff is a Node.js library and CLI draft. Callers provide sitemap XML, parsed entries, or a sitemap URL for retrieval. XML parsing and comparison run in the caller's Node.js process. URL retrieval makes outbound requests from that process. The tool has no product backend, telemetry, analytics, account system, or persistent source-document cache. The CLI can write a generated report to a path selected by the caller.

`urlset` entries are treated as comparison data: their `loc` values are not fetched. A `sitemapindex` may refer to child sitemap documents; loading such an index can make additional outbound requests, subject to traversal limits. XML cannot choose local filesystem paths. Local file reads belong to the CLI, which passes document contents into the library.

## Input and resource controls

The parser accepts the standard Sitemap 0.9 namespace and `urlset` or `sitemapindex` roots. It rejects `DOCTYPE`, malformed XML, duplicate fields, invalid metadata values, and entries without `loc`. The direct parser defaults to a 5 MiB UTF-8 document limit and 50,000 entries. The loader/fetcher applies per-document and aggregate traversal budgets:

| Control | Default |
| --- | ---: |
| Request timeout | 10 seconds |
| Raw response and decoded document size | 5 MiB per document for fetch/load and direct parser |
| Decoded data across a traversal | 20 MiB |
| Index references and URL entries across a traversal | 50,000 |
| Sitemap documents | 100 |
| Sitemap-index depth | 5 |
| Redirects | 3 |
| Private or local network destinations | blocked unless `allowPrivateNetworks` is explicitly enabled |

The parser also limits XML element nesting to 128. Callers can override the direct parser's byte and entry limits. Loader limits are finite and validated as safe integers, except depth and redirect counts, which may be zero.

Limits can constrain a single request and recursive sitemap-index traversal. For already-parsed input, byte budgets count the UTF-8 size of the sanitized supported JSON shape, including syntax and escaped string values; XML markup is not present in parsed values, and unknown properties are stripped. Comparison also has a configurable `maxEntries` default of 50,000 per input. These limits do not guarantee that all remote hosts respond safely or quickly, and the caller remains responsible for deciding which sites it trusts. Do not set limits to unbounded values or enable private-network access for untrusted sitemap URLs.

## Network and SSRF boundary

Passing a remote sitemap URL authorizes the library to make an HTTP(S) request from the current process. The library resolves the hostname, rejects the target if any returned address is not considered public, and pins the connection to one checked address. It repeats those checks across redirects and rejects HTTPS-to-HTTP redirects. This reduces SSRF exposure but is not a substitute for egress controls, a network sandbox, or host allowlisting. DNS and network behavior depends partly on the runtime and environment. If a workflow processes URLs from untrusted users, run it in a restricted environment with outbound network access limited to approved destinations.

Enabling `allowPrivateNetworks` removes the default private-address safeguard. Use it only when the caller intentionally needs to read internal sitemap hosts and controls the supplied URLs. Callers cannot supply arbitrary request headers, credentials, or custom request hooks through the API.

## XML and comparison behavior

XML parsing uses `saxes`. It does not resolve external entities; explicit document type declarations are rejected. Sitemap-index references must be absolute HTTP(S) URLs. Fetch accepts identity or gzip responses, infers gzip from a `.gz` URL path, and caps both raw and expanded byte counts. Other content encodings are rejected. Query normalization is opt-in except that URL fragments are stripped by default; callers should use normalization options only when that matches their site semantics. Duplicate normalized URLs are reported, and comparison represents each URL using its first entry.

## Known limits and release checks

- The review is based on the development source and does not replace review of the exact npm tarball and dependency lockfile.
- Before release, re-check URL/IP classification (including IPv4-mapped IPv6 and DNS behavior), redirect handling, decompression limits, and request cleanup against the final source.
- Keep every per-request and aggregate limit finite. The current reader caps compressed/raw and expanded bytes independently.
- The current loader tracks active and already-seen sitemap URLs and counts aggregate bytes, entries, documents, and depth across each traversal; preserve these controls if traversal changes.
- Complete [third-party notices](../THIRD_PARTY_NOTICES.md) for all production dependencies.
- Publish only after the API, tests, supported Node versions, and documentation match the release artifact.

Report vulnerabilities using the private channel in [SECURITY.md](../SECURITY.md).
