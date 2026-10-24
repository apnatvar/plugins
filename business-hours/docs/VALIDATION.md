# Validation record

Validated 2026-10-24 after completing implementation, tests, documentation and package
configuration. No commit, npm publication or website deployment was performed.

## Environment and observed results

Local environment: Windows, Node.js 22.16.0, npm 11.9.0, ICU 77.1, tzdata 2025b.
Runtime dependencies: @js-temporal/polyfill 0.5.1 and jsbi 4.3.2. Exact dependency
versions and integrity hashes are locked in package-lock.json.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed after correcting an internal exactOptionalPropertyTypes declaration |
| `npm run lint` | Passed for source, tests and consumer script |
| `npm run build` | Passed, ESM JavaScript and public declarations emitted |
| `npm test` | All 28 deterministic tests passed; no skipped tests |
| `npm audit --audit-level=low` | Passed, 0 known vulnerabilities across the full dependency tree |
| `npm run check:consumer` | Passed: tarball file allowlist, clean installation, ESM runtime and strict TypeScript consumer |
| `npm pack --ignore-scripts --json` | Passed; 10 files, 20,277 compressed bytes / 60,916 unpacked bytes |
| Hub `node scripts/check-site.cjs` | Passed; 14 pages, metadata, sitemap, local links/assets and hosting configuration |
| Git whitespace check for touched repository paths | Passed |

The initial sandboxed Node test-worker launch returned EPERM before running tests;
the same test command passed outside that sandbox. npm packaging also required cache
access outside the sandbox. These were execution-environment restrictions, not skipped
checks. The emitted package and consumer import were exercised successfully.

The first hub check exposed missing shared favicon/social assets referenced by its
pages. A reproducible System.Drawing generator and the four required assets were
added; the subsequent hub check passed.

## Calendar and security coverage

The 28 tests cover explicit instants and malformed dates; half-open boundaries;
split, touching and overnight periods; clipped unions and overlapping source periods;
inclusive/exclusive transitions; finite horizons and empty/24-hour schedules; date
and query limits; holiday/exception/provider precedence and incoming overnight
suppression; provider failures and configuration snapshot isolation; Gregorian leap
days and century rules; year-end carry; New York gaps/folds and 23/25-hour days;
overnight DST shifts; Lord Howe's half-hour transition; Apia's skipped date and overnight carry-in/destination closure under all
four policies; and London/Kolkata timezone fixtures.

Security fixtures include unsafe keys, accessors, symbols, extra array properties,
excessive date/period counts, a huge sparse array, malformed disambiguation, invalid
instants and provider return values. Review also replaced persistent callback caching
with per-calculation caching and quadratic conflict comparisons with a sorted sweep.
No runtime network/filesystem calls, telemetry or background jobs are present.

## Artifact and remaining manual steps

Artifact: `brownsmithdynamics-business-hours-0.1.0.tgz`.
SHA-1 reported by npm: `229ff07019aa01bf34b9ed108a0e0c6726972475`.
The package's main source is approximately 22 KB emitted JavaScript; Temporal and
JSBI are external dependencies and are not bundled in that size.

Only Node 22 was executed locally. The prepared root workflow `.github/workflows/ci.yml`
covers Node 22 and 24 on Ubuntu and Windows once pushed; remote CI has not run in this
task. No browser visual/interactive QA was performed; the hub changes are static and
passed structural/link/asset checks. Runtime timezone data must be kept current.

The owner confirmed npm scope `brownsmithdynamics`; its organization endpoint returned
HTTP 200. Authentication and `apnatva`'s team membership/publishing permission remain
manual release prerequisites. See PUBLISHING.md for current policy sources, dependency
licenses, privacy findings and the 2FA release checklist. The npm badge only resolves
after publication; the CI badge requires a pushed workflow and real run.
