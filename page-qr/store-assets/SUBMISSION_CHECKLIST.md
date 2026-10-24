# Page QR Submission Checklist

**Status:** Preparation draft — do not submit until the open items below are complete.  
**Publisher:** Brownsmith Dynamics  
**Contact:** contact@brownsmithdynamics.com

## Public information

- [ ] Publish `PRIVACY_POLICY.md` at https://plugins.brownsmithdynamics.com/page-qr/privacy/ and verify it loads publicly without sign-in.
- [ ] Publish a Page QR homepage at https://plugins.brownsmithdynamics.com/page-qr/ and verify it loads publicly without sign-in.
- [ ] Publish a support page at https://plugins.brownsmithdynamics.com/support/ with working contact instructions; verify public access.
- [ ] Confirm the privacy, homepage, and support URLs in the dashboard point to the final live pages. These URLs are planned and are not yet live or verified.
- [ ] Confirm the published policy and dashboard privacy disclosures still match the exact package being submitted.

## Store assets and listing

- [x] Create the 512 × 512 logo and the 128 × 128 store icon; configure the manifest icon entries.
- [x] Prepare two 1280 × 800 screenshots demonstrating the real popup code with labelled example URLs. See `ASSETS.md` for provenance; installed-extension testing remains separate.
- [x] Prepare the 440 × 280 px small promotional tile and the 1400 × 560 px marquee tile. See `ASSETS.md` for files and editable sources.
- [ ] Enter the title, short summary, full description, single-purpose statement, and `activeTab` justification from `CHROME_WEB_STORE_LISTING.md`.
- [ ] In Privacy practices, disclose local access and processing of the active tab URL accurately; state that the developer receives no user data; complete and affirm the Limited Use certification.
- [ ] Review distribution, language, category, and any dashboard declarations for accuracy.

## Runtime package and manual submission

- [ ] Prepare the submission ZIP from runtime files only: `manifest.json`, `popup.html`, `popup.css`, `popup.js`, `vendor/qrcode.js`, and any required runtime assets added later.
- [ ] Exclude `tests/`, development notes, README files, Git metadata, and other source or repository-only files from the runtime package. Keep the vendor license obligations satisfied if the encoder is redistributed.
- [ ] Confirm the ZIP has `manifest.json` at its root and contains the complete runtime needed by the extension.
- [ ] Install the exact runtime package in Chrome and exercise it on a normal HTTP/HTTPS page, including a URL with query and fragment; inspect the QR destination and downloaded PNG, try copy, and try share where available.
- [ ] Check that unsupported browser/internal pages and an over-capacity URL show a clear error.
- [ ] Review the final ZIP contents and dashboard preview manually, then submit through the Chrome Web Store Developer Dashboard. Store submission is manual only; no automated upload or publishing is part of this preparation.

## Current readiness

The logo, store icon, two demonstration screenshots, extended description and
shorter listing description are prepared. The configured subdomain URLs still
need verification as public pages without sign-in. Both promotional tiles are
prepared. Installed-extension Chrome testing and manual store submission remain outstanding.

## Official references

- [Chrome Web Store listing fields and assets](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Chrome Web Store image requirements](https://developer.chrome.com/docs/webstore/images)
- [Chrome Web Store User Data FAQ and Limited Use requirements](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)

