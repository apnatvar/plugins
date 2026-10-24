# Contributing

Sitemap Diff is a small Node.js library for parsing and comparing XML sitemaps. Contributions should preserve its bounded-input behavior, clear errors, and dependency-light API.

## Before opening a change

- Read the [README](README.md), [security assessment](docs/security-assessment.md), and [security policy](SECURITY.md).
- Keep new behavior aligned with the documented URL normalization and comparison rules.
- Do not add telemetry, remote services, or implicit crawling of sitemap indexes.
- Include only synthetic sitemap fixtures. Do not add customer URLs, credentials, or production crawl data.
- Explain any new network access, parser dependency, or raised resource limit in the change description.

## Development

The package is ESM-only and requires Node.js 22 or later. From this directory:

```sh
npm install
npm run typecheck
npm run lint
npm run build
npm test
```

Use the package scripts as the source of truth if they change before the first release. Keep generated output and `node_modules` out of commits.

## Pull requests

Describe the behavior change, security implications, and a small reproducible example. Update the README, examples, changelog, and security assessment when behavior or limits change. Do not include secrets, access tokens, unpublished npm credentials, or private sitemap contents.

By submitting a contribution, you agree that it may be distributed under the project's [MIT License](LICENSE).
