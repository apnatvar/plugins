# Security policy

## Reporting a vulnerability

Please do not report exploitable vulnerabilities in a public issue. Contact [contact@brownsmithdynamics.com](mailto:contact@brownsmithdynamics.com) and include a description, impact, and a minimal reproduction. Do not include customer data or secrets in a report. We will acknowledge reports and coordinate a fix and disclosure with the reporter.

## Safe use

CSV files are untrusted input. This package parses values as text and does not evaluate CSV formulas. A configured `transform` is ordinary JavaScript supplied by the caller; only use trusted functions. For untrusted or large files, set parser size, record, and field limits and set `maxErrors` so malformed input cannot produce unbounded diagnostic output.

Mapping errors are designed to avoid echoing raw CSV values. Applications should still avoid logging entire input rows or returning detailed diagnostics to unauthorized users. Validate schema definitions and mapping options at application boundaries.

CSV quoting protects the syntax of serialized CSV, but spreadsheet software can still interpret formula-looking cells as formulas. `serializeCsv()` defaults to `formulaProtection: 'escape'`, which prefixes cells that begin with formula markers with an apostrophe; use `formulaProtection: 'reject'` to fail when such a cell is present. The implementation also detects leading whitespace/control characters and full-width formula markers.

These mitigations do not provide a universal guarantee across spreadsheet applications. In particular, Excel may remove quoting or escape characters when a CSV is saved and reopened, which can reactivate a formula. OWASP describes this limitation and alternative trade-offs in its [CSV Injection guidance](https://community.owasp.org/attacks/CSV_Injection). Test files in the actual destination application and workflow. If an output must never execute formulas, reject formula-looking cells or use a format and import workflow that treats values as text; any transformation can affect downstream data.

## Supported versions

Security fixes are made against the latest maintained release. Update to the latest release before reporting a vulnerability.
