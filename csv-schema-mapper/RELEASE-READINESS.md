# Release-readiness report

Date: 23 October 2026. Candidate: `@brownsmithdynamics/csv-schema-mapper@0.1.0`.

**The owner confirmed the package name spelling. The package is unpublished; npm user `apnatva`'s organization membership and publishing permissions still need owner verification.** Nothing was committed, pushed, deployed, or published; npm credentials were not used.

## Delivered

Strict TypeScript source is separated into parser, schema/type definitions, bounded header matching, transformers, validator, serializer, error reporting, browser-safe root API, and Node file helpers. The package has no runtime dependencies. Its ESM exports and generated declarations expose CSV parsing, exact/alias/explicit/opt-in fuzzy mapping, confidence metadata, conservative conversions, required/type checks, bounded diagnostics, JSON records, CSV export, and string/file/stream entry points.

README examples, API reference, performance/memory guidance, MIT license, SECURITY, CHANGELOG, CONTRIBUTING, publishing/compliance findings, and an inventory of development dependency licenses are included. Repository-root GitHub Actions checks Node 22 and 24; Dependabot covers this package and Actions. CI has read-only repository permissions and no publication job or secrets. npm version/download badges are deliberately absent until a real package listing exists; the CI badge is explicitly pending its first pushed run.

The existing local plugins hub includes a product listing and `dist/csv-schema-mapper/index.html`, reusing the site design and attribution. Installation is labeled pending publication. Source links point to the verified repository root because this new source directory is not pushed.

## Final validation results

Environment: Windows PowerShell; Node v22.16.0; npm 11.9.0. All source, tests, documentation, and configuration were created before suite execution. Tests consume generated JavaScript, so compilation occurs before tests.

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS, strict mode plus unchecked-index and exact-optional checks |
| `npm run lint` | PASS, supported ESLint 10 and TypeScript rules |
| `npm run build` | PASS, JavaScript, declarations, and source maps emitted |
| Unit/integration tests | PASS, 39 tests across mapping, parser, Node files, and stream/serialization |
| Security-specific tests | PASS, 16 tests |
| Total final test coverage | 55 tests, 0 remaining failures; affected suites rerun after fixes |
| `npm audit --audit-level=low --json` | PASS, 0 known vulnerabilities at any severity; 98 development dependencies, zero runtime dependencies |
| Dependency license review | PASS, 98 declared tooling licenses inventoried; MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, BlueOak-1.0.0 |
| `npm pack --dry-run --ignore-scripts` | PASS, explicit allowlist, no dependencies, credentials, test fixtures, or caches shipped |
| `npm run check:consumer` | PASS, real tarball installed offline into a separate project; ESM root and Node subpath execute; strict TypeScript consumes declarations |
| Focused website check | PASS, new guide/catalog headings, local link targets, anchors, and API example |
| Existing full website checker | FAIL on pre-existing homepage `noindex,nofollow`; existing metadata/assets/sitemap mismatch remains outside this change |
| Public link verification | GitHub source root, brand root, and current plugins hub each returned HTTP 200 |

Initial sandboxed Node test workers could not spawn (`EPERM`); the suites ran successfully with local execution permission. This was an execution-environment failure, not a library defect. Initial static checks exposed strict typing and lint errors, which were corrected. One initial corpus test used default trimming while expecting whitespace preservation; its schema now explicitly sets `trim:false`. No checks were bypassed or disabled to hide failures.

Tests include a deterministic 50-record corpus with empty cells, quote runs, delimiters, CR/LF/CRLF, accents, and emoji; streaming is compared at every split point and one UTF-16 code unit at a time. The regression suite also compares valid prefixes followed by malformed data across different chunk boundaries.

After the owner confirmed `@brownsmithdynamics`, package metadata, lockfile, examples, and website copy were updated. Public registry checks confirmed the scope endpoint returns HTTP 200 and the package returns HTTP 404. The corrected-scope dry run and separate-project offline consumption checks both passed, including root/Node imports and strict declaration consumption. Source and dependencies were unchanged; the prior 55 passing tests and clean audit were not rerun for this metadata-only correction.

The corrected archive `brownsmithdynamics-csv-schema-mapper-0.1.0.tgz` contains 50 entries, is 46,801 bytes compressed (191,713 bytes unpacked), and has integrity `sha512-gcW/DN8/xDqfFwCo832HtXrpqQ/YhwwyE5UXhq2cDoDTXSyianmEA6dci6TKYNoxO4lAiIHfhFI3vmCA8AXNxw==`. Consumer archives remain under ignored `.consumer-check/` directories. This report is excluded from the runtime archive.

## Security findings and remediations

These are implementation-review findings, not assigned CVEs. All listed defects were addressed before final verification.

| Area | Remediation and evidence |
| --- | --- |
| Spreadsheet formula injection | Default apostrophe escaping and optional rejection apply to headers and cells, including whitespace/control prefixes and full-width formula markers; security tests pass. Documented that spreadsheet save/reopen behavior prevents a universal guarantee. |
| Prototype pollution / unsafe assignment | Forbidden schema keys and unsafe source headers fail closed; output properties use safe own definitions; serializer reads own properties only. JSON-derived forbidden keys and null-prototype schemas are tested. |
| Malformed input and record corruption | Strict quoting, consistent escaped quotes across chunks, exact multiline content preservation, and row-width validation. Parser generators preserve completed records before later malformed input regardless of chunking. |
| Oversized input and memory | Configurable byte, field, record, row, column, output, and error budgets. Files are bounded during actual reading rather than trusting a stat; serializer stops infinite iterables at its row cap. Accumulation and producer-owned allocations are documented. |
| Matching CPU exhaustion | Bounded headers, schema fields, aliases, name lengths, candidate count, and a total edit-distance cell budget; fuzzy matching is opt-in. Ties fail closed and explicit choices override automatic selection. |
| Encoding / Unicode | Fatal UTF-8 decoding, lone-surrogate rejection, split surrogate/multibyte handling, consistent single BOM removal, and rejection of mixed binary/text stream chunks. Normalization and collisions are documented. |
| Silent conversion damage | Reject unsafe integers, nonzero underflow, ambiguous dates, nonexistent calendar dates, missing timezone timestamps, and unsupported submillisecond precision. Validate custom transform output types; handle years 0000–0099 correctly. Binary floating-point limits are documented. |
| Diagnostic leakage | Error messages omit raw cell values, raw unknown/duplicate header names, and callback exception details. Retain schema field names and physical source lines. Header setup diagnostics remain on line 1. Metadata and native file I/O errors require caller redaction. |
| Truncated errors | Terminal `MAX_ERRORS` is observable and stops mapping; no silent infinite stream of suppressed errors. |
| Development supply chain | Replaced an unsupported ESLint 9 installation with supported ESLint 10; public installs used isolated configuration and disabled lifecycle scripts. Current audit is clean. |

## Remaining release actions

1. Verify npm account `apnatva`'s membership in the `brownsmithdynamics` organization and publishing rights before release. The public organization endpoint returned HTTP 200 with an empty package list and the corrected package endpoint returned HTTP 404, indicating the package is unpublished. These public responses do not verify ownership or permissions.
2. Follow [PUBLISHING.md](PUBLISHING.md) from the source checkout. It records sources, licensing/privacy assessment, the confirmed package name, remaining owner verification, validation commands, artifact inspection, interactive manual publication, and the required npm package setting **“Require two-factor authentication and disallow tokens.”** No automation or trusted publisher is configured.
3. Commit/push only with separate authorization, run the configured Node 22/24 GitHub matrix, and obtain the real CI status. Node 24 and Linux CI were configured but not executed in this Windows session.
4. The website updates are local only. Its full checker has an existing SEO baseline failure, and visual browser QA was not performed. Resolve the site's existing SEO work before its next deployment, then deploy only with separate authorization. The new route's canonical URL is a future deployment target, not a verified live page.

The audit is a point-in-time advisory check; no independent penetration test, legal certification, or throughput/heap guarantee is claimed. The package processes CSV locally and contains no network/analytics code; caller-supplied callbacks retain the caller’s privileges. Privacy obligations depend on the consuming application, as documented in PUBLISHING.md.
