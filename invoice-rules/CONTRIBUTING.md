# Contributing

Contributions should keep validation deterministic, bounded, and explicit about jurisdictional assumptions. Open an issue or discussion for changes to the public API, validation codes, or monetary semantics so those contracts can be reviewed before implementation.

## Development

The repository uses TypeScript source, Node's built-in test runner, and generated JavaScript output under `dist/`. Install the development dependencies, build the project, and run the tests using the scripts defined in `package.json`.

```sh
npm install
npm run build
npm test
```

When adding a validation rule, document its code, path behavior, default severity, and whether applications can override that severity. Keep messages useful to a caller and avoid echoing sensitive input values. Add focused tests for valid and invalid cases, decimal boundaries, malformed structures, and configured limits where relevant.

Do not add jurisdiction-specific rates or assume that a format check proves legal validity. Prefer caller-supplied policy or an explicitly named optional module. Changes to rounding or arithmetic require examples that explain the behavior and compatibility impact.

## Pull requests

Keep changes scoped, describe the observable behavior, and state which build or test commands you ran. Do not commit generated output unless the repository's release process asks for it. Never include real invoices, credentials, customer data, or private vulnerability details.

## Releases

The package is not published yet. A release should update the changelog and version, verify package contents and metadata, build from a clean checkout, and publish only after the maintainer confirms repository ownership, package naming, and security contact details.
