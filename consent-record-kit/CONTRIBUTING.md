# Contributing

Maintained by [Brownsmith Dynamics](https://brownsmithdynamics.com). Contributions use MIT licensing. Discuss schema or authentication changes before implementation; preserving versioned canonical bytes is a compatibility requirement. Keep runtime dependencies at zero unless there is a reviewed need. Never add telemetry, network calls, sensitive fixtures, secrets or publishing tokens.

Use Node.js 22+ and npm. Install development tools with `npm ci --ignore-scripts`. Complete code, tests and documentation before running checks. Run typecheck, lint, build, `npm test`, dependency audit, tarball inspection and `npm run check:consumer` in that order. Add meaningful tests for security boundaries and fixed canonical vectors. Do not silently change schema 1.0 or HMAC domain separation. Report security issues privately as described in SECURITY.md. Publishing and deployment require a maintainer's separate manual release process with 2FA; CI never publishes.
