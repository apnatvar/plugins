# Publishing and policy research

Reviewed 2026-10-24. Release is manual; CI has no npm token, publish or deployment job.

## Scope verification

The owner confirmed `@brownsmithdynamics/business-hours`, correcting the initial
`brownmsithdynamics` spelling. Public npm registry organization-package endpoints
were checked on the review date:

- `https://registry.npmjs.org/-/org/brownmsithdynamics/package` returned HTTP 404.
- `https://registry.npmjs.org/-/org/brownsmithdynamics/package` returned HTTP 200 `{}`.
- The public user endpoint for `apnatva` returned HTTP 401.

The confirmed scope matches sibling packages and the successful endpoint. These
checks do not establish `apnatva`'s membership, organization ownership or publish
permission. Verify those interactively before release. Package metadata, lockfile,
README and local hub use the confirmed spelling. No organization was created or renamed.

## npm rules

Primary sources, consulted on the review date:

- [Package name guidelines](https://docs.npmjs.com/package-name-guidelines/): use an
  available, valid lowercase URL-safe name and avoid confusing or misleading names.
  The proposed scoped package is syntactically valid; ownership/availability is a
  separate check. Avoid silently publishing under a misspelled organization.
- [Scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/):
  public scoped publication requires public access; package.json sets `publishConfig.access`.
- [npm Open Source Terms](https://docs.npmjs.com/policies/open-source-terms/): maintainers
  must have the rights to publish their package content; public distribution carries
  npm's terms in addition to the selected code license. Review these at release.
- [2FA publication settings](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/):
  interactive publishing requires a 2FA challenge. Select **Require two-factor
  authentication and disallow tokens** for this manual release process. The documented
  default also permits bypass-2FA granular tokens; this project does not use those.
  Governance actions have separate interactive requirements as of August 2026.

## Dependency licenses and timezone data

The installed/locked runtime dependency `@js-temporal/polyfill` 0.5.1 is ISC;
its dependency `jsbi` 4.3.2 is Apache-2.0. Metadata and actual installed LICENSE
files were inspected. ISC requires retaining its copyright and permission text.
Apache-2.0 requires preserving its license and applicable notices on redistribution,
including its patent/notice conditions. The library is MIT; this does not relicense
dependencies. Dependencies are external npm packages, not bundled into emitted JS.
THIRD_PARTY_NOTICES.md includes their full license texts for redistributors.

Source references: [Temporal polyfill license](https://github.com/js-temporal/temporal-polyfill/blob/main/LICENSE),
[JSBI license](https://github.com/GoogleChromeLabs/jsbi/blob/main/LICENSE).
The lockfile is authoritative for exact installed versions. Development dependencies
TypeScript (Apache-2.0), ESLint/@eslint/js/typescript-eslint (MIT), and their transitive
dependencies are not included in the published files. Re-audit the full lockfile when
updating dependencies; development tooling still runs on maintainer/CI machines.

No tzdata or holiday database is bundled. Temporal relies on host Intl/ICU timezone
data. [IANA describes tzdb as public domain](https://data.iana.org/time-zones/tz-link.html).
Runtime distributors may have additional ICU/software notices; this package does not
redistribute Node or ICU. If future packaging embeds tzdata, ICU or holiday lists,
review that actual artifact's license and preserve required notices before release.
Consumers supplying public holidays must verify their source's license and accuracy.

## Privacy findings

The library performs in-memory calculations with supplied values. It includes no
telemetry, network client, cookie access, persistent storage or background tracking.
Installing a package contacts the user's configured npm registry; that is package
manager behavior, not library telemetry. A consumer-provided holiday callback is
application code and can change the application's privacy characteristics.

There is no observed personal-data collection by the library requiring a separate
collection notice. This is a technical finding, not a blanket exemption for every
application or jurisdiction. Applications processing appointment/customer data need
their own applicable privacy assessment and notices. For example, the UK regulator's
[right to be informed guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-be-informed/)
requires privacy information when personal data is collected. The static product
page introduces no analytics/forms, while hosting and support providers have their
own processing. Do not claim that the whole website or support channel collects no data.

## Manual publication checklist

1. Confirm the exact scope with the organization owner. Authenticate interactively
   using `npm login`; check `npm whoami` returns `apnatva`, and verify membership and
   team publish permission in npm's organization UI. Never paste credentials into Git.
2. Check the final name with `npm view <confirmed-name> name version` and confirm an
   appropriate unused version. A registry 404 is expected for a new package, but do
   not confuse permission or connectivity errors with availability.
3. Review the complete Git diff, MIT ownership, dependency notices, package metadata,
   changelog and README. Commit/push only when explicitly requested by the owner.
   The repository is https://github.com/apnatvar/plugins, package directory business-hours.
4. On Node 22 and 24, run `npm ci --ignore-scripts`, `npm run check`,
   `npm audit --audit-level=low`, `npm pack --dry-run`, and `npm run check:consumer`.
   Inspect packed filenames and size. Record versions/tzdata and resolve failures.
5. Configure account 2FA using npm's current supported method, retain recovery access,
   and select the package setting requiring 2FA and disallowing tokens when available.
6. Run `npm pack --ignore-scripts`, retain the exact reviewed tarball and checksum,
   and have the owner manually run `npm publish <reviewed-file.tgz> --access public`.
   Complete the interactive 2FA challenge personally. This document is an instruction
   for the owner; no agent command in this task publishes anything.
7. Verify registry metadata, clean installation and the resulting npm page. Then add
   verified package/source links to the local product page and replace unpublished
   labels. The CI badge only reports real status once the workflow is pushed and run;
   an unpublished npm badge is not a claim of availability.
8. Publish website changes only in a separately authorized deployment. Keep future
   releases manual, review advisories and recheck changing npm rules before each release.

## Validation record

See docs/VALIDATION.md in the repository for actual executed checks, versions,
findings and remaining release prerequisites. A passing local run is not a remote CI run.
