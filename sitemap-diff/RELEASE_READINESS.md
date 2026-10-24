# Release readiness — 0.1.0

Reviewed 23 October 2026. Implemented for [Brownsmith Dynamics](https://brownsmithdynamics.com). This is a local release candidate; no package publication, GitHub push, website deployment, or commit was performed.

## Package identity

- Package: `@brownsmithdynamics/sitemap-diff`, version `0.1.0`, MIT, ESM with declarations, Node.js 22+.
- The originally requested `brownmsithdynamics` organization returned npm `E404 Scope not found`. `npm org ls brownsmithdynamics` returned successfully. The user explicitly approved changing to `@brownsmithdynamics`.
- Both package-name lookups returned E404. No public npm listing, version badge, or downloads badge is claimed. The organization lookup does not prove that `apnatva` can publish.
- Repository identity came from the local Git remote: `https://github.com/apnatvar/plugins.git`, package subdirectory `sitemap-diff`, branch `main`.

## Passed checks

Executed after the implementation and initial test creation were complete:

| Check | Actual result |
| --- | --- |
| `npm run typecheck` | Passed with TypeScript strict mode, exact optional properties, and unchecked-index checks. |
| `npm run lint` | Passed for source and test code, including the final tarball smoke script. |
| `npm run build` | Passed; ESM JavaScript and declaration files generated. |
| `npm test` | 47 tests passed, 0 failed, 0 skipped. Parser, normalization, comparison, reports, DNS answers and pinning, redirect revalidation, local HTTP integration, gzip, resource limits, circular references, and CLI covered. |
| `npm audit --audit-level=low --json` | Zero reported advisories across the installed dependency graph. |
| `npm audit signatures` | 99 packages had verified registry signatures; 30 had verified attestations. |
| Production dependency review | `saxes@6.0.0` and `xmlchars@2.2.0`; upstream ISC/MIT notices retained in `THIRD_PARTY_NOTICES.md`. |
| Security source review | Reviewed XML/DTD handling, DNS resolution and pinning, redirects, IP policy, stream cleanup, decompression, recursion, parsed-input budgets, normalization, and terminal output. Findings concerning empty userinfo and early parsed-input budgeting were fixed. |
| `npm pack --dry-run --json` | Passed; final dry-run inventory exactly matched the generated package inventory. |
| Actual tarball inspection | 37 allowlisted files, 27,962 compressed bytes, 92,099 unpacked bytes. JavaScript, declarations, documentation, licenses, and synthetic examples included; tests, development dependencies, caches, local reports, and credentials excluded. |
| Final tarball installation | Installed in a fresh temporary directory with lifecycle scripts disabled; package-name root and all exported module subpath imports passed. Declaration files were present. Installed CLI help and a real comparison passed. Temporary installation removed. |
| `node examples/compare.mjs` | Passed, producing JSON and Markdown from synthetic example domains. |
| Website checker | Passed: 13 pages, local links/assets, draft metadata, policy coverage, and hosting configuration. |
| Website visual review | New landing page inspected in the local in-app browser at desktop width. Temporary browser tab and preview server closed. |
| Scoped `git diff --check` | Passed for tracked task-related changes. No commit made. |

Validation ran on Windows with Node.js `22.16.0` and npm `11.9.0`. Earlier failures consisted of sandbox subprocess restrictions, one invalid extension fixture expectation, and a parsed-input byte-accounting issue; the subsequent validation pass passed all 47 tests.

## Artifact

`brownsmithdynamics-sitemap-diff-0.1.0.tgz`

SHA-256:

```text
2b2d4d9b6dd0e2b1de8d6e46db8a9dc863bade83dac163f9a270d37e8679f900
```

The tarball and local pack inventories are ignored by Git. This report is a source handoff document and is deliberately outside the publish allowlist, so its checksum does not depend on itself.

## Website changes

The existing plugins application checkout is `../../sites/bd-plugins-ppdf/`. Added the Sitemap Diff catalog entry and `dist/sitemap-diff/index.html`, updated support/source navigation and matching styles/checker, and retained local draft/noindex metadata and hosting identity. The source links use the verified repository identity; these new source paths have not been pushed. The older `sites/bd-plugins/` checkout was not changed by this task.

## Unresolved release prerequisites

- `apnatva` publishing access and npm 2FA/account recovery must be verified interactively. No authentication state was inspected or altered.
- The GitHub Actions workflow is configured for Windows and Ubuntu with Node.js 22 and 24, pinned official action revisions, read-only permissions, and no publishing step. Hosted CI and the nonlocal matrix have not run because changes were not pushed.
- Source links and the workflow badge become active for these files after an authorized GitHub push. npm links and badges should be added only after publication is independently verified.
- This is a source/security review and advisory scan, not an independent penetration test or a certification. Runtime limitations and deployment-specific privacy responsibilities are documented in the README, security assessment, and publishing guide.

## Actions reserved for the owner

1. Review the source and confirm `apnatva` has organization publishing rights and npm 2FA enabled. Require 2FA and disallow tokens in the package's npm publishing settings when available.
2. Authorize any Git commit or push separately; run the configured GitHub CI before release.
3. Publish manually only after approval, using the inspected artifact and interactive npm 2FA:

   ```sh
   npm publish ./brownsmithdynamics-sitemap-diff-0.1.0.tgz --access public
   ```

   The directory alternative is `npm publish --access public` after building; choose one form. Full account, packing, verification, policy, license, and privacy instructions are in `PUBLISHING.md`.
4. Authorize website deployment separately. Keep the local draft status until the release and public pages are verified.

Existing unrelated changes in the shared repository were preserved. No npm token was modified, committed, or exposed.
