# Publishing

This document describes how to prepare and manually publish `@brownsmithdynamics/consent-record-kit` to the public npm registry. It is a release procedure, not legal advice. Review the release checklist before every publication.

## Package identity and public links

The owner confirmed `@brownsmithdynamics/consent-record-kit` on 2026-10-24, correcting the original `brownmsithdynamics` transposition. Public unauthenticated HTTP checks on that date found:

- [Correct npm organization metadata](https://registry.npmjs.org/-/org/brownsmithdynamics/package): HTTP 200, empty package map `{}`. This verifies the public endpoint, not account ownership or write permission.
- Original misspelled organization endpoint: HTTP 404.
- [Repository metadata](https://api.github.com/repos/apnatvar/plugins): HTTP 200, `full_name: apnatvar/plugins`, `private: false`, matching the local Git remote. The verified [repository root](https://github.com/apnatvar/plugins) is safe to link; the new source directory and CI workflow have not been pushed.

No live npm package listing or completed remote CI run is claimed. Add the npm version and build/test badges only after their live targets exist and are checked. Before publication, an authorized maintainer must confirm scope ownership and grant the releasing account write access. Do not create a similarly named org to work around unavailable access.

The npm account `apnatva` has not been verified as the owner or authorized publisher for this scope. Verify the public account/org relationship manually before release; this research did not access credentials or account settings.

## Requirements

- The package manifest `name` must equal `@brownsmithdynamics/consent-record-kit` exactly. Check the scope and package spelling in `package.json`, README install instructions, release notes, and repository metadata.
- The package must be intended for public release. A scoped package is private by default; the first public release must use `--access public`.
- Use an npm account with permission to publish under the confirmed scope. npm requires account 2FA or a granular token explicitly configured to bypass 2FA for package publication. For a manual release, use an interactive login and respond to the 2FA challenge. Do not put OTPs, passwords, or tokens in source files, command history, logs, or this document.
- npm's current docs recommend interactive 2FA and offer staged publishing for a human review step. Direct publishing with bypass-2FA granular tokens is being deprecated; npm says direct publish via such tokens will be removed in January 2027. Do not establish a new token-based release procedure for this manual workflow.
- Confirm the selected version has never been published. npm does not allow republishing the same package name and version.

## Manual release procedure

Run from the package root after the checklist is complete:

1. Review the exact files that would ship with `npm pack --dry-run`. Resolve accidental inclusion of secrets, local files, test fixtures containing personal data, and irrelevant build output. Confirm the packed archive includes the license, README, and required runtime files.
2. Confirm `npm whoami` identifies the intended publisher and inspect the package name and version with `npm pkg get name version`. `npm whoami` confirms the current CLI identity, not permission to publish this scope.
3. Ensure the npm account has 2FA enabled and that the current session can answer an interactive challenge. Keep the one-time code private.
4. Publish the first version publicly with `npm publish --access public`. Follow the npm CLI's interactive 2FA prompt. For subsequent versions, the package is already public; confirm visibility on npm before release. Do not use `--otp=<code>` in a saved script or shared command.
5. Verify the published name, version, access level, README, license, and tarball contents on npm. Check the package installation instructions against the published artifact.
6. Record the release version, date, source commit, and npm listing URL in the project release notes.

npm also supports staged publication: a publish creates a private stage, a maintainer inspects it, then approves it with an interactive 2FA challenge (or rejects it). This is useful when the release needs a final registry-side review. Follow npm's current `npm stage` instructions if choosing this workflow; staged publishing commands and trust configuration evolve, so do not copy commands from an old checklist without checking the linked docs.

## npm and release security references

Official npm documentation checked 2026-10-24:

- [Creating and publishing scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/) — public scoped packages require `npm publish --access public`; direct publication requires account 2FA or a granular token with bypass 2FA.
- [Requiring 2FA for package publishing and settings modification](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/) — describes interactive 2FA and package-level publishing settings.
- [About access tokens](https://docs.npmjs.com/about-access-tokens/) — says legacy tokens were removed in November 2025; direct publishing using bypass-2FA tokens is slated for removal in January 2027; staged approval requires a human and 2FA.
- [Trusted publishing for npm packages](https://docs.npmjs.com/trusted-publishers/) — CI/OIDC option; it removes long-lived publish tokens and generates provenance for supported public GitHub/GitLab workflows. It requires configuration on the existing package and repository. This document's release path remains manual.
- [Package scope, access level, and visibility](https://docs.npmjs.com/package-scope-access-level-and-visibility/) — organization-scoped packages require an existing organization and appropriate team permissions.

## Privacy and legal documentation

This package is a library. The inspected implementation has no default data collection, persistence, telemetry, or network transport. Distributing a pure library does not by itself require a separate end-user collection privacy policy solely because the package is distributed. A concise privacy statement can still help adopters understand the library's behavior, and product documentation should explain its schema and limitations. The library does not establish that a consent request is valid, that a controller has a lawful basis, or that an integrating deployment complies with privacy law.

Assess the project website, hosting logs, cookies/analytics, support channels, demos, and maintainer workflows independently. If those activities process personal data, determine the applicable notice and privacy obligations for those activities. An integrating application remains responsible for notices to its users, its consent interface, controller/processor roles, data storage and transmission, retention, withdrawal, export, and deletion.

## Privacy law notes and open legal questions

Research current as of 2026-10-24; obtain qualified counsel for a product-specific review.

- India's Digital Personal Data Protection Act, 2023 was brought into force in phases by Gazette notification dated 2025-11-13. The notification places the core processing duties in sections 3–17 and several related provisions at 18 months after publication (2027-05-13); section 6(9) and section 27(1)(d) at one year (2026-11-13); and specified institutional/administrative provisions immediately. The Digital Personal Data Protection Rules, 2025 were also phased: Rules 1, 2 and 17–21 immediately; Rule 4 after one year; Rules 3, 5–16, 22 and 23 after 18 months. These dates matter on the research date, but the release should be rechecked against later Gazette notifications and amendments.
- Under GDPR Article 7, when processing relies on consent, the controller must be able to demonstrate it; a consent request embedded in another declaration must be distinguishable, clear, accessible, and plain; withdrawal must be possible at any time and as easy as giving consent; consent must be freely given. Article 7 alone does not make a stored record sufficient proof: the product must capture appropriate evidence and preserve its integrity. See also Articles 4(11), 5, 6, 12–14, 17, 25 and 30 as applicable.

Open questions to resolve before asserting legal compliance or publishing legal claims:

1. What exact data does the library collect, persist, transmit, or emit, including identifiers, IP/device data, timestamps, purposes, policy/version text, and analytics?
2. Is it only a client-side data model/utility or does it ship a hosted service, backend, telemetry, or demo? Who selects purposes and means, and who is controller, processor, or subprocessor for each deployment?
3. How do integrations handle withdrawal, correction, deletion, retention limits, access requests, audit integrity, backups, and proof that the notice shown is the notice accepted?
4. Does the product serve children, sensitive data, or users in multiple jurisdictions? Which age thresholds, representative/parental-consent processes, and local rules apply?
5. Is consent the appropriate lawful basis for each purpose? Are separate purposes granular and optional, and can users refuse without detriment where required?
6. What data transfers, subprocessors, hosting regions, incident processes, security controls, and retention schedules apply to the deploying organization?
7. Who maintains and approves the public privacy policy, terms, legal disclaimers, and any jurisdiction-specific notices? Has counsel reviewed them against the shipped implementation?

### Primary legal sources

### Obligations versus this library

For DPDP sections 5–6 as their commencement applies, consent needs an affirmative, voluntary, purpose-specific and informed choice. Requests need understandable language and the required language options/contact information. Withdrawal must be comparably easy; the fiduciary must stop relevant processing within the applicable period unless another legal authorization applies. Section 6(10) places the burden of demonstrating notice and consent on the fiduciary. Rule 3 adds notice detail, including the data and purposes and routes to withdrawal, rights and complaints. Source: [DPDP Act, sections 5–6](https://www.indiacode.nic.in/bitstream/123456789/22037/2/a2023-22.pdf), checked 2026-10-24, and the Rules linked below. This npm utility is not a registered DPDP Consent Manager.

Under GDPR, retaining evidence must not become excessive additional collection. Preserve the actual notice/version and collection context with an appropriate retention rationale; a subject label and boolean alone do not prove the legal conditions. See [EDPB Guidelines 05/2020, version 1.1, 4 May 2020](https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf), checked 2026-10-24. Cookie/device access may also engage ePrivacy/national rules, separately from GDPR. The library implements none of these UI, operational or jurisdictional decisions; it records selected technical fields and authenticates their bytes.

### Source register

- [India Gazette notification G.S.R. 843(E), 13 November 2025 (DPDP Act commencement)](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf)
- [India Gazette notification G.S.R. 846(E), 13 November 2025 (Digital Personal Data Protection Rules, 2025)](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)
- [India MeitY DPDP Rules 2025 explanatory note](https://www.meity.gov.in/writereaddata/files/Explanatory-Note-DPDP-Rules-2025.pdf)
- [EU GDPR, Regulation (EU) 2016/679, EUR-Lex consolidated text](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679)
