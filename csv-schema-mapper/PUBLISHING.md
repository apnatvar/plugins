# Publication and compliance review

Reviewed 23 October 2026. This package is unpublished. No npm credentials were read or used, and no registry or repository writes were performed. Publication is manual and requires the owner’s interactive 2FA.

## Confirmed package name and remaining owner check

The owner confirmed the package name **`@brownsmithdynamics/csv-schema-mapper`**. The package remains unpublished. Unauthenticated registry checks returned:

| Public endpoint | Result |
| --- | --- |
| `https://registry.npmjs.org/@brownsmithdynamics%2fcsv-schema-mapper` | HTTP 404, package not found; unpublished |
| `https://registry.npmjs.org/-/org/brownsmithdynamics/package` | HTTP 200, empty public package list |

The organization endpoint confirms the public scope exists; its empty package list and the package endpoint’s 404 indicate that this package is unpublished. These public responses do **not** prove ownership, membership, or publishing rights. Before publication, the human owner must confirm in npm’s UI that npm user `apnatva` belongs to the `brownsmithdynamics` organization and has publishing rights.

The Git remote and public HTTP 200 verify [the source repository](https://github.com/apnatvar/plugins). The package’s source directory is `csv-schema-mapper`; the current local branch is `main`. Its remote directory will be available only after a separately authorized push. The [brand website](https://brownsmithdynamics.com) and [existing plugins hub](https://plugins.brownsmithdynamics.com) also returned HTTP 200. The new product route is local and has not been deployed.

## npm requirements and publishing policy

Public scoped packages require an existing user/organization scope and public access. Organization membership must grant write permission. See [organization-scoped publication](https://docs.npmjs.com/creating-and-publishing-an-organization-scoped-package/) and [scope identity](https://docs.npmjs.com/about-scopes/).

Select **“Require two-factor authentication and disallow tokens”** in package publishing settings. Do not configure trusted publishers, bypass tokens, release Actions, or npm secrets for this project. npm supports other authentication mechanisms, but this project’s policy is manual interactive 2FA only. See [npm publishing protection settings](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/). package.json cannot enforce account/package security settings; the owner must set and verify them in npm.

CI has read-only repository permission and validates/builds/packs only. It has no publishing job. There is no publish lifecycle script or credential configuration in this package. A lockfile and explicit package allowlist make the shipped artifact reviewable. Public npm version/download badges must be added only after a real listing exists; the CI badge must not be treated as evidence until the workflow has run remotely.

## Manual release procedure (owner only; not executed)

1. Work from the source checkout’s `csv-schema-mapper` directory, not an installed npm copy (development scripts/tests are intentionally excluded from npm). Review the final source, license, changelog, and release-readiness report. Verify npm user `apnatva`'s organization membership and publishing rights. Obtain separate authorization to commit/push changes. Verify supported Node versions in CI.
2. With Node 22.13+ (or Node 24), install from the committed lockfile: `npm ci --ignore-scripts`. Run `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, `npm run test:security`, and `npm audit --audit-level=low`. Tests import generated dist files, so compilation precedes tests.
3. Run `npm pack --dry-run --ignore-scripts`, inspect the allowlisted files, and run `npm run check:consumer`. This last command packs a real archive and installs it offline into a separate temporary project for runtime and declaration verification.
4. Use an owner-controlled terminal to sign in interactively as `apnatva` with 2FA. Confirm identity with `npm whoami`; confirm exact organization membership and publishing permissions in npm. Do not paste credentials, session output, or OTPs into chat or files. The isolated public npm configs under scripts/ are for dependency checks, not owner authentication.
5. Create the final archive with `npm pack --ignore-scripts`. Inspect it and publish that reviewed file manually with `npm publish ./<reviewed-archive>.tgz --access public --registry=https://registry.npmjs.org/`. Complete the interactive npm 2FA challenge. Never put the OTP in a script or saved shell command.
6. For a first release, immediately select and verify package-level “Require two-factor authentication and disallow tokens.” Confirm no trusted publishers or bypass tokens are configured. Recheck these settings for every release.
7. Verify the public package name, version, owner/maintainers, license, declaration files, install from registry, and repository URL. Then update actual npm badges and product availability. Deploying the hub remains a separate authorized action.

## Licenses and redistribution

The library is MIT licensed, free to use, modify, and redistribute, including commercially. Preserve its copyright and license notice; the [OSI MIT text](https://opensource.org/license/mit) explains the permission and warranty terms. This is a software license, not permission to reuse Brownsmith Dynamics trademarks.

There are **zero production dependencies**. Development tools are not bundled into the published runtime. The 98 installed development packages declare MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, or BlueOak-1.0.0 licenses, recorded in `docs/dependency-licenses.json`. Regenerate the inventory with `node scripts/dependency-licenses.mjs` after dependency changes. These permissive tooling licenses require preserving applicable notices if the tools themselves are redistributed; do not copy development dependencies into the artifact. npm audit checks known registry advisories, not license compatibility or absence of unknown vulnerabilities.

## Privacy and local data processing

The runtime contains no HTTP client, analytics, telemetry, AI API, subprocess invocation, or remote processing. Core functions consume caller-provided data in memory; Node helpers read only the requested file. Developer-supplied transforms execute with the caller’s privileges and may themselves transmit data: the library cannot control those callbacks.

Our assessment is that distributing this local library alone does not give Brownsmith Dynamics access to CSV contents or make it a processor for that content. Applications using it must evaluate their own controller/processor roles, legal basis, privacy notices, retention, security, and any processor contracts. The [European Commission’s explanation of controller and processor roles](https://commission.europa.eu/law/law-topic/data-protection/data-protection-explained_en) and [EDPB guidelines on controller and processor roles](https://www.edpb.europa.eu/system/files_en?file=2023-10%2FEDPB_guidelines_202007_controllerprocessor_final_en.pdf) support assessing each actual processing activity. GDPR Articles 4, 13–14, 28 and 32 are relevant where that law applies; other jurisdictions and sensitive data may impose additional duties. This is a scoped engineering assessment, not a jurisdiction-specific legal opinion. No blanket “GDPR compliant” claim is made.

Errors exclude source cell values and callback exception details, but mapping metadata, headers, and field names can themselves contain personal information. Callers should restrict and redact diagnostics and outputs. Support reports must use synthetic examples. npm installation and the public website involve separate third-party network requests, outside CSV runtime processing.

## Spreadsheet export safety

The serializer defaults to prefixing suspicious formula cells with an apostrophe and offers a rejecting mode. This changes exported text deliberately; raw mapped JSON is unchanged. Spreadsheet applications and save/reopen cycles differ, so do not promise universal formula safety. Use reject mode for workflows that must avoid formula-leading text and control the destination. See [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection).
