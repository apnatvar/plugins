# Publishing

Sitemap Diff is not published. This document is a release checklist, not evidence that an npm package exists.

## Before the first release

1. Confirm publisher access to `@brownsmithdynamics`. On 2026-10-23, `npm org ls brownmsithdynamics` returned `E404 Scope not found`. The corrected `npm org ls brownsmithdynamics` returned an existence response, but that does not establish account membership or package ownership. `npm view` returned `E404` for both `@brownmsithdynamics/sitemap-diff` and `@brownsmithdynamics/sitemap-diff` on that date; there was no listing. Verify membership and package access before release.
2. Confirm the package name is available and that the configured `repository` points to `https://github.com/apnatvar/plugins` with the correct package subdirectory. Do not add a live npm URL or badge until publication is verified.
3. Review the packed file list and ensure generated declarations, README, license, security policy, changelog, and completed third-party notices are included. Exclude tests, local data, credentials, and unrelated workspace files.
4. Review the final source, dependency lockfile, release notes, and security assessment. Check that the minimum Node.js version and documented API match the release artifact.
5. Log in interactively and verify the account and organization access. `npm login` can update the local npm authentication configuration; do not share that file or any credential it contains:

   ```sh
   npm login
   npm whoami
   npm org ls brownsmithdynamics
   npm profile get
   ```

   Confirm `npm whoami` reports `apnatva`, verify that account has publishing rights in the organization, and require `auth-and-writes` two-factor authentication. If it is not enabled, npm documents this command:

   ```sh
   npm profile enable-2fa auth-and-writes
   ```

   This project requires manual interactive publication with npm 2FA. Do not create, paste, store, or expose a token for this release. For the package, select **Require two-factor authentication and disallow tokens** in npm's Publishing access settings when the package exists, and retain that setting for subsequent releases. Organization-wide 2FA enforcement is configured in npm's organization settings and can remove members who do not have 2FA enabled; verify the impact before changing that setting.

6. Run the package checks, inspect the dry-run package contents, and create the release tarball:

   ```sh
   npm audit --omit=dev
   npm run check
   npm pack --dry-run --json
   npm pack --json
   ```

   Inspect the tarball filename returned by `npm pack --json`, then list its contents with `tar -tzf <tarball-filename>`. Confirm the `dist/`, README, license, security policy, changelog, completed third-party notices, examples, and docs are present, and no tests, credentials, or unrelated workspace files are included.

7. From this directory, smoke-test and publish the inspected 0.1.0 tarball publicly:

   ```sh
   node test/package-smoke.mjs brownsmithdynamics-sitemap-diff-0.1.0.tgz
   npm publish ./brownsmithdynamics-sitemap-diff-0.1.0.tgz --access public
   ```

   If publishing the package directory instead, run `npm run build` first and use `npm publish --access public`. Do not publish both forms. Verify the tarball filename and version from `npm pack --json` before the tarball commands; update the smoke-test filename when the version changes.

8. Verify the published package page, version, tarball contents, and README directly on npm. Only then update publication status, release links, and any badges.

## Authentication and provenance

npm's current documentation says scoped packages default to private visibility and a first public publish uses `npm publish --access public`. npm requires account 2FA or a granular token that bypasses it; this project recommends the interactive 2FA route for a manual first release. The commands above follow npm's [login](https://docs.npmjs.com/cli/v11/commands/npm-login/), [whoami](https://docs.npmjs.com/cli/v11/commands/npm-whoami/), and [2FA configuration](https://docs.npmjs.com/configuring-two-factor-authentication/) documentation. Organization-wide enforcement is controlled from npm's [organization settings](https://docs.npmjs.com/requiring-two-factor-authentication-in-your-organization/), not by a CLI command. Policy checked 2026-10-23: [publishing scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/) and [npm publishing 2FA requirements](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/).

For a future automated release, prefer npm trusted publishing with GitHub Actions OIDC and provenance after configuring and verifying it. Do not add an npm token to source, local config, command arguments, or workflow logs. npm's [trusted publishing guidance](https://docs.npmjs.com/trusted-publishers/) and [provenance requirements](https://docs.npmjs.com/generating-provenance-statements/) were checked 2026-10-23. No automated publisher is configured by this draft.

## Repository license

The source and packaged documentation use the MIT License. GitHub's [repository licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository) explains that a public repository without a license retains default copyright restrictions; keep the included `LICENSE` aligned with the intended source and npm package permissions. The MIT identifier and text were cross-checked against the [SPDX License List](https://spdx.org/licenses/MIT) on 2026-10-23. This is a release checklist, not legal advice.

## GitHub publication and use

Keep the package source, examples, and issue reports within GitHub's [Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) and [Acceptable Use Policies](https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies). In particular, do not use repository or issue data for spam, publish private information, or automate excessive requests against GitHub. The public source link in the local website is a draft reference; do not describe the package as published or released until the source and intended release tag are present and verified in the repository. GitHub's policies were reviewed 2026-10-23.

## Privacy and jurisdiction review

The library has no service backend or telemetry, but a caller using remote loading sends requests from its own process to the supplied sitemap hosts and index children. Those requests expose connection metadata such as source IP address and user-agent to the contacted hosts and network providers. Sitemap URLs and query strings can themselves contain identifiers; callers should avoid putting personal or confidential values in inputs and should keep generated reports under their own access controls. The static product website and hosting provider may separately process visitor connection logs under their own privacy terms.

For EU/EEA deployment, assess whether the GDPR applies based on establishment, offering services to people in the Union, or monitoring their behavior; do not infer applicability only from website reachability. The GDPR identifies IP addresses and other online identifiers as information that may relate to an identifiable person ([Article 3](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng), [Recital 30](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679)). For India, assess the Digital Personal Data Protection Act against the actual processing and territorial scope. The commencement notification issued 13 November 2025 phases the Act: its main processing provisions are scheduled to commence 18 months after publication, on 13 May 2027, while specified institutional and other provisions commenced earlier ([MeitY Gazette notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf); [MeitY Rules and timeline index](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa)). These references do not establish that a particular deployment is compliant or that every provision is currently in force. Re-check the applicable law, commencement notifications, hosting arrangements, and each party's role before release. This is operational context, not legal advice. Policy and commencement checked 2026-10-23.
