# Contributing

Thanks for contributing. Keep changes focused, preserve the public ESM API, and add or update `node:test` coverage for behavior changes. Avoid introducing runtime dependencies unless there is a clear need.

## Local workflow

Use a supported Node.js LTS release. Install dependencies with `npm install`, build with `npm run build`, and run the test suite with `npm test`. Tests import the built package from `dist/`, so rebuild after changing source before running them.

When changing parser behavior, cover valid quoting and newline cases as well as malformed input and configured limits. When changing mapping behavior, cover explicit and inferred header selection, conversions, missing values, and bounded error output. Do not put real customer data in fixtures.

## Pull requests

Explain the user-visible behavior and any API changes. Include validation performed and note any compatibility impact. Do not commit generated secrets, local environment files, or customer data.

## Releases

Release and publishing details are maintained in [PUBLISHING.md](PUBLISHING.md). Only maintainers should publish package releases.
