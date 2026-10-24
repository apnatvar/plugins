# Validation record — 2026-10-24

Local environment: Windows, Node.js v22.16.0, npm 11.9.0. Package 0.1.0; owner-confirmed name `@brownsmithdynamics/consent-record-kit`. This record is a local engineering result, not an independent audit or remote CI result.

All implementation, tests and initial documentation were completed before the first suite execution. Results:

| Check | Outcome |
| --- | --- |
| Strict TypeScript `npm run typecheck` | Passed. |
| ESLint `npm run lint` | Passed. |
| Declaration/ESM build `npm run build` | Passed. |
| Unit/security `npm test` | 13 tests passed, 0 failed, 0 skipped. |
| Canonical serialization | Literal golden vector and independent SHA-256/HMAC vectors passed; purpose order permutations, Unicode spelling preservation, UTF-8 byte caps and canonical JSON round trips passed. |
| Tampering/forgery | Wrong keys and changed record fields, key IDs, algorithms, and malformed tags rejected. Explicit test demonstrates that a newly computed unkeyed hash verifies a forged record while the original HMAC does not. |
| Hostile input | Unknown schemas/fields, non-plain prototypes, symbols, property/array getters, sparse/custom arrays, duplicate purposes, invalid identifiers/calendar times, malformed/oversized JSON, duplicate JSON keys and prototype-pollution payloads rejected. |
| npm dependency audit | `npm audit --audit-level=low`: found 0 vulnerabilities, including development dependencies. Zero runtime dependencies. Advisory results are a dated snapshot, not a vulnerability-free guarantee. |
| npm tarball review | Allowlist includes compiled JS/declarations, package manifest, MIT license, README, security/release/publishing docs and synthetic example. Excludes tests, source, caches, development tooling, credentials and installed dependencies. |
| Packaged integration | Local tarball installed offline into an isolated temporary consumer; real package-name ESM import and strict NodeNext TypeScript compilation passed. Sample adapter duplicate insertion and withdrawal history passed. Repeated after the owner-confirmed scope correction. |
| Website | Existing local `sites/bd-plugins` catalog and `/consent-record-kit/` guide updated. Static checker passed for 14 pages, metadata, sitemap, crawl rules, local links/assets, policy coverage and hosting config. No browser visual QA or deployment performed. |

The sandbox initially blocked test-worker process creation (`spawn EPERM`); the same test command passed when worker creation was permitted. Public dependency installation likewise required network access. Neither is reported as a library test failure. npm user/global configurations were disabled for the successful public dependency/audit/package checks; no credential inspection, login or publishing occurred.

## Factual vulnerability assessment

No exploitable package vulnerability was identified in the covered source inspection or tests. There was no independent penetration test, fuzzing campaign, formal proof, or verification on every supported runtime. Node 24/Linux/Windows CI is configured but has not run remotely. The static [security assessment](SECURITY_ASSESSMENT.md) documents threat boundaries and remaining operator responsibilities.

HMAC key compromise permits forgery; hashes alone permit unauthenticated recomputation; receipts do not prove collection or identity. Time is caller/local-clock supplied. Replay prevention, uniqueness, atomic lifecycle state, full authenticated chain validation, encryption and retention are application responsibilities. Arbitrary in-process Proxy objects are outside the hostile-JSON boundary. No claim of legal compliance follows from passing these checks.

## Outstanding release decisions

- Verify npm user `apnatva` has organization publishing rights and interactive 2FA enabled; no account settings were accessed.
- Confirm a private security reporting channel and response ownership.
- Run CI after an explicitly authorized push and add genuine build/test badges only after a real run exists. Add an npm badge only after a verified public release exists. The MIT badge is present now.
- Resolve deployment-specific legal questions in [PUBLISHING.md](../PUBLISHING.md), particularly notice evidence, lawful basis, withdrawal enforcement, retention/erasure, children and website/support processing. This library neither determines nor certifies those obligations.
- No commit, push, deployment or npm publication was made. The website remains a local draft and package 0.1.0 remains unreleased.
