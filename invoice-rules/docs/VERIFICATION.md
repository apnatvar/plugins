# Implementation verification

Verified locally on 24 October 2026 with Windows, Node.js 22.16.0, npm 11.9.0, and TypeScript 5.9.3. This is an engineering record, not an external security audit or tax certification.

| Check | Result |
| --- | --- |
| Strict TypeScript (`npm run typecheck`) | Passed, including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Initial type narrowing errors were corrected before testing. |
| Build (`npm run build`) | Passed; ESM JavaScript, source maps and declaration files emitted. Rebuilt after final security changes. |
| Full suite (`npm test`) | All 40 tests passed after implementation. The first sandbox attempt could not launch Node test processes (`spawn EPERM`); an approved execution retry passed. No test assertions failed. |
| Final security regression | Added a test for inherited severity names and expanded malformed-option cases after code review. All 19 tests in `security.test.mjs` and `validation.test.mjs` passed on the final runtime build. There are now 41 tests in total; the unaffected 22 arithmetic/India/example tests retain their earlier passing results. |
| Dependency audit (`npm audit --audit-level=low --json`) | Advisory service returned zero vulnerabilities across all severities. No runtime dependencies; the one development dependency is pinned TypeScript. Checked without npm account authentication using isolated empty configs. |
| Package (`npm pack --dry-run --ignore-scripts`) | Passed. 27 allowlisted files: runtime/declarations/source maps, fictional examples, metadata, license and documentation. No tests, dependency directory, npm configs, cache, credentials or consumer workspaces included. |
| Tarball consumer (`npm run check:consumer`) | Passed for the final runtime build. Packed and installed the generated tarball offline into a fresh temporary project; root/India ESM imports, actual invoice validation and strict TypeScript consumer compilation passed. Temporary project removed with a verified path guard. |
| Website (`node scripts/check-site.mjs`) | Passed: invoice catalog route, local href/src targets, unique page anchors, and the actual displayed CGST/SGST example executed against the built library. No layout/browser inspection performed. |
| Legal/source review | Dated primary references and their limits are in PUBLISHING.md. The owner confirmed the corrected scope `@brownsmithdynamics`. |

Covered cases include rounding ties and negative ties, precision 0/3/6, 12-digit fractional rates, grouped tax rounding, fixed/percentage discounts, refunds, zero-value items, malformed decimals, arithmetic bounds, leap dates, party IDs, GST component/state checks, prototype pollution, getters, cycles, sparse/hidden/symbol input, resource limits, immutable rule snapshots, invalid rule output, exception redaction, and JSON-safe issues.

## Remaining verification limits

- npm user `apnatva` membership and publish permission in `brownsmithdynamics` remain unverified. The public organization page requests did not establish these facts; no credentials were accessed to resolve them.
- The configured repository remote is `https://github.com/apnatvar/plugins.git`. Public access and the uncommitted module's source URL were not verified. No npm listing exists as part of this work.
- Node.js 24 checks are configured in GitHub Actions but were not run locally. Browser bundler/runtime and visual layout checks were not performed.
- The accessible consolidated CBIC source found in this review is amended through 1 January 2022; current transaction-specific applicability and later notifications require maintainer review. No official primary-source checksum formula was found. The locally implemented checksum is a technical check; registration status, TAN variants and UINs are outside its claim.
- Arbitrary Proxy traps and trusted custom code/regexes cannot be sandboxed by this in-process validator. Hosts must apply request and execution budgets.

No commits, pushes, npm publication, website deployment, government portal calls, account login or credential inspection were performed. Manual release and any deployment require the owner's explicit authorization and the checklist in PUBLISHING.md.
