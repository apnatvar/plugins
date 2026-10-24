# Contributing

Use Node.js 22+ and npm. Run `npm ci --ignore-scripts`. Change source in `src/`,
add deterministic node:test cases in `test/`, and update README/CHANGELOG for API changes.
Complete code, tests and documentation before running `npm run check`, then
`npm audit --audit-level=low` and `npm run check:consumer`. Re-run failed checks after fixes.
Never use the current clock in fixtures; provide explicit instants and IANA zones.
Explain interval boundaries, DST disambiguation and override behavior in bug reports.
Include runtime versions (`process.versions.icu` and `process.versions.tz` are useful).
Do not include customer appointment data, credentials or private holiday datasets.

Submit focused pull requests against https://github.com/apnatvar/plugins.
No contributor should publish or deploy as part of CI. Maintainers publish manually
with 2FA; see PUBLISHING.md. Security reports go through SECURITY.md.
