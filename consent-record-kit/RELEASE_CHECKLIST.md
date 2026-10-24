# Release checklist

Use this checklist for each release of `@brownsmithdynamics/consent-record-kit`. Publishing is an external action; complete the checks before running the publish command. This document was researched on 2026-10-24 and must be checked against current npm and legal sources when used.

## Identity and ownership

- [ ] Confirm the package name is exactly `@brownsmithdynamics/consent-record-kit` in `package.json`, docs, and release notes.
- [x] Owner confirmed the corrected `brownsmithdynamics` scope on 2026-10-24.
- [x] Public npm organization metadata returned HTTP 200 on 2026-10-24.
- [ ] Verify that the organization belongs to the intended publisher and grants npm user `apnatva` write permission. Public existence does not prove either.
- [x] Verified public GitHub repository `apnatvar/plugins` against the local remote and unauthenticated GitHub API on 2026-10-24.
- [ ] Confirm the public npm package URL after the first release: <https://www.npmjs.com/package/@brownsmithdynamics/consent-record-kit>.

## Contents and package metadata

- [ ] Review the version, changelog, README, package description, keywords, license, repository, homepage, and support links.
- [ ] Confirm `private` is not `true`; confirm the package's license expression matches the actual license file and intended distribution.
- [ ] Check that install/use instructions refer to the exact scope and that API examples match the built package.
- [ ] Review package files and `files`/ignore rules for credentials, local config, unpublished source, user data, example secrets, and unnecessary files.
- [ ] Inspect `npm pack --dry-run` output and confirm all runtime files, license, and README are included.
- [ ] Confirm the package does not claim that it makes an integrating app “GDPR compliant” or “DPDP compliant.” Describe only demonstrated behavior and limitations.
- [ ] Document data fields and behavior: what is recorded, where it is stored or sent, how consumers can export/delete it, and whether any telemetry exists. If this project website, demo, or support process collects data, publish an accessible privacy policy describing that collection.
- [ ] Link the public privacy information from the package README/docs where applicable. A privacy policy does not replace the application's consent notice or consent controls.
- [ ] Resolve the legal questions in `PUBLISHING.md` or explicitly keep claims narrow and factual pending counsel review.

## Version and release readiness

- [ ] Confirm the version is a valid semver release and has not already been published. npm does not allow the same name/version pair to be republished.
- [ ] Ensure the source revision to be released is the reviewed revision and release notes describe user-visible changes and migration steps.
- [ ] Complete the project's normal build and quality review before release, following repository-specific instructions.
- [ ] Confirm there is no unresolved issue that changes package identity, privacy behavior, license, or release contents.

## Manual npm publication

- [ ] Confirm the CLI is logged into the intended npm account (`npm whoami`) and that the account can publish under the confirmed scope. `npm whoami` alone does not verify package write permissions.
- [ ] Confirm account 2FA is enabled and interactive access to its second factor is available. Do not place OTPs or credentials in scripts, source, logs, or shared command lines.
- [ ] Confirm the package's access policy is appropriate. Scoped packages default to private; the first public release requires `npm publish --access public`.
- [ ] Review the final tarball listing with `npm pack --dry-run` immediately before publishing.
- [ ] Publish interactively with `npm publish --access public` for the initial public version, and satisfy the npm 2FA prompt. For later releases, verify existing public access first and use the current npm instructions.
- [ ] If using npm staged publishing, inspect the stage and approve it with an interactive 2FA challenge only after the artifact is reviewed. Consult the current npm stage docs for exact commands.
- [ ] Do not set up a bypass-2FA direct-publish token for this manual procedure. npm's current docs state such direct publishing is scheduled for removal in January 2027.

## Post-publication record

- [ ] Open the npm package page and confirm name, version, public visibility, README, license, and artifact contents.
- [ ] Confirm the documented install command resolves to the published package and version.
- [ ] Record publication date, version, source revision, publisher, package URL, and any incident or rollback notes in the release record.
- [ ] If an error is found, follow npm's current package deprecation/unpublish policy and the project's incident process; do not assume a published version can simply be overwritten.

## References checked 2026-10-24

- [npm: Creating and publishing scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)
- [npm: Requiring 2FA for package publishing](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/)
- [npm: About access tokens](https://docs.npmjs.com/about-access-tokens/)
- [npm: Trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [India DPDP Act commencement notification, G.S.R. 843(E), 13 November 2025](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf)
- [India DPDP Rules, G.S.R. 846(E), 13 November 2025](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)
- [GDPR, Regulation (EU) 2016/679, EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679)

Research is operational guidance, not a legal opinion. Recheck commencement, rules, npm security requirements, and package/account state on release day.
