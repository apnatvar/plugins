# Manual npm publishing notes

Research checked 24 October 2026. This is a checklist for a maintainer publishing manually; it does not publish anything.

## Package identity

The owner confirmed `@brownsmithdynamics/invoice-rules` on 24 October 2026, correcting the scope typo in the original request. Public organization-page requests did not establish ownership or membership. The maintainer must confirm that npm user `apnatva` has publishing access to `brownsmithdynamics` before release. No account credentials were inspected. npm scopes are the account or organization namespace, and scoped packages publish privately by default unless `--access public` is supplied. A published name/version pair cannot be reused, so verify the spelling and version before publishing.

## Manual release sequence

Complete this checklist before any authorized manual release:

- Confirm scope access for `apnatva`, review the public author/repository metadata and verify the intended repository is accessible. The local git remote is evidence of configuration, not evidence that this uncommitted directory is publicly available.
- Install from the committed lockfile with `npm ci --ignore-scripts`; run `npm run check` after completing implementation and any source changes.
- Run `npm audit --audit-level=low` against current advisory data; review development licenses and `THIRD_PARTY_NOTICES.md`. No runtime dependencies are expected.
- Run `npm pack --dry-run --ignore-scripts`; inspect generated JavaScript, declarations, examples, notices and package exports. Confirm no tokens, real invoices or private source are present.
- Run `npm run check:consumer` to pack, install offline in a clean project, exercise root/India ESM exports and compile a strict TypeScript consumer. It deletes only its own verified `.consumer-*` directory.
- Review the dated statutory-source limitations below and current applicable notifications with a qualified maintainer. Confirm security contact, version and changelog; obtain explicit approval for the release.
- Publish only by the maintainer's authorized manual 2FA process. CI checks do not publish; there is no token-based publishing workflow.
- After publication, verify the exact npm listing and version, then update catalog availability/package links only after verification. Website deployment requires separate authorization.

1. Review the built package contents and metadata locally. Check `package.json` `name`, `version`, `license`, `files`, `main`/`types` or `exports`, README, and included license notices. Run `npm pack --dry-run` and inspect the file list; do not include credentials, private invoice data, or unnecessary local files.
2. Confirm all code and bundled dependencies may be redistributed under the chosen package license. Keep the package's own license file and preserve notices/attributions required by dependency licenses. A package's `license` field is a declaration, not a substitute for checking the actual license texts and obligations.
3. Sign in to the npm account that owns the selected user or organization scope. npm currently requires either account 2FA or a granular access token explicitly allowed to bypass 2FA for publishing. For a manual release, use interactive publishing with 2FA enabled; do not place an OTP or token in source control or command history.
4. In the package root, publish the reviewed version with `npm publish --access public`. Scoped packages need that explicit public-access option. Check the resulting package page and install the exact published version in a clean consumer project.

Publishing makes package files and metadata publicly available for download. Do not put personal data, customer invoice samples, secrets, or private source material in the tarball. npm's terms give it permission to host and share uploaded package content; public package content can be copied or retained by others, including after removal. The package should also clearly identify third-party software and its licenses where required.

## Privacy and legal scope

No separate collection-based privacy policy or additional end-user contract appears necessary for distributing this offline module itself: the MIT license supplies its copyright terms and warranty disclaimer, and the runtime collects/transmits/stores nothing. This is a design assessment, not a legal conclusion for every distributor. The local documentation edits add no forms, tracking, cookies or external scripts; the existing website privacy notice still needs the operator's review for hosting logs and platform behavior before deployment. A consuming application remains responsible for its own invoice data processing, notices and applicable legal obligations. Add specific terms/privacy documentation if future features introduce hosted validation, telemetry, accounts or data collection.

The current package is designed for offline validation: the India module performs checks in-process and makes no network requests or persistent writes. It does not transmit invoice fields. The current package manifest has no runtime dependencies; TypeScript is development-only, and the repository's third-party notice records that boundary. Recheck the built tarball and dependency tree if implementation or packaging changes. npm collects account and registry-use information and may associate publisher identity/contact information with the public package; its privacy notice explains those practices. Review the current applicable Indian privacy law and commencement notifications with qualified counsel before adopting this library in a product that collects or processes personal data. This documentation is not legal advice.

The GST options are configurable checks, not a complete Rule 46 compliance engine. Rule 46 includes details such as supplier identity/address, recipient details, HSN or service accounting code, taxable value, tax rates and amounts, place of supply with State name for inter-State supply, and reverse-charge status. Applicability and required HSN digits vary with invoice category and notifications. This library's model lacks several of those fields and does not decide whether an invoice is legally required, exempt, or complete under every notification. Configure only checks appropriate to the transaction and have tax counsel review production rules.

## GSTIN check boundary

The India helper checks the conventional 15-character PAN-based GSTIN shape and a locally calculated check character. It does not cover the TAN-based assignment form mentioned in the CGST Rules, and it is not a UIN validator. The CGST Rules state that the final GSTIN character is a checksum and define the broad field composition, but do not specify checksum arithmetic in the rule text. Accordingly, the code documents the widely used base-36 alternating-factor implementation as an implementation-level check, not a legally prescribed calculation or certification. A valid shape/checksum does not establish that a GSTIN was issued, is active, belongs to the named party, or is valid for a transaction. The GST Portal's taxpayer search is the official route to inspect registration status; this library does not call it.

GST component checks are deliberately limited to the ordinary configured case. The IGST Act defines inter-State and intra-State treatment with place-of-supply rules and specific exceptions, including SEZ and import/export cases. The library checks labels only when the caller explicitly supplies `india.supplyType` and enables the option. It does not derive legal supply type from state codes, invoice addresses, or GSTINs. The optional state-consistency check expects `india.placeOfSupply` to contain a two-digit state code and compares it with the supplier state or GSTIN prefix only when `supplyType` is explicitly `intra` or `inter`. State-code acceptance remains caller-configurable through `allowedStateCodes`; the library does not embed a static code registry.

## Sources checked 24 October 2026

- [CBIC consolidated CGST Rules, Part A, Rule 10: GSTIN assignment and checksum character (amended through 1 January 2022)](https://cbic-gst.gov.in/pdf/amended-01012022-CGST-Rules-2017-Part-A.pdf)
- [CBIC registration page: GSTIN composition under its older Rule 3 numbering](https://cbic-gst.gov.in/gst-registration-rules.html)
- [CBIC: Tax Invoice particulars under the CGST Invoice Rules](https://cbic-gst.gov.in/gst-invoice-rules.html)
- [IGST Act, 2017: inter-State and intra-State supply provisions](https://cbic-gst.gov.in/hindi/IGST-bill-e.html)
- [GST Portal: Search Taxpayer and GSTIN/UIN status](https://tutorial.gst.gov.in/userguide/taxpayersdashboard/Search_Taxpayer.htm)
- [India Code / Gazette: Digital Personal Data Protection Act, 2023](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf)
- [npm: Creating and publishing scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)
- [npm: Requiring 2FA for package publishing](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/)
- [npm: Open Source Terms](https://docs.npmjs.com/policies/open-source-terms/)
- [npm: Privacy questions and answers](https://docs.npmjs.com/policies/privacy/)
- [npm: `npm pack` dry-run behavior](https://docs.npmjs.com/cli/v7/commands/npm-pack/)

Source retrieval checked 24 October 2026. The CBIC consolidated PDF located for this review is amended through 1 January 2022 and says the compilation is for convenience, with Gazette notifications having force of law; I did not locate a newer consolidated Part A on CBIC during this check. Its Rule 10 says the ten middle characters may be PAN or TAN, followed by two entity-code characters and one checksum character. The separately linked CBIC HTML registration page contains the same field description under older Rule 3 numbering. Neither source describes checksum arithmetic. The PAN-based regex implemented here therefore covers the common GSTIN shape only, not all forms described by that broad statutory schema. CBIC's invoice-rule page provides the listed Rule 46 particulars, while the GST Portal guide describes taxpayer status lookup. The DPDP Act PDF states that commencement is by Central Government notification; no claim is made here about which provisions are currently in force. npm documentation pages linked above were retrieved successfully. No official primary source specifying the checksum algorithm was found in this review.
