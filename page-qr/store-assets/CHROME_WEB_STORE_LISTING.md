# Chrome Web Store Listing — Page QR

**Status:** Draft; verify all linked public pages are live before submission.  
**Publisher:** Brownsmith Dynamics

## Title

Page QR

## Short summary

Create a QR code for the current page URL, then download or copy it as a PNG.

(78 characters; Chrome Web Store short description limit is 132 characters.)

## Full description

Create a QR code for the HTTP or HTTPS page you are viewing. Open Page QR to preview the code, then download the PNG or copy the image. If your browser supports file sharing, you can also share the PNG with your device's native share interface.

The QR code contains the complete page URL, including its path, query parameters, and fragment. Check the address before sharing: URLs can contain information you may consider sensitive. The PNG includes a small [BD] Brownsmith Dynamics footer beneath the QR code.

**Why Page QR needs `activeTab`:** This permission lets Page QR read the active tab's URL after you click the extension. It uses the URL locally to create the QR code for the current page. Page QR does not request access to all websites or tabs.

**Your URL stays on your device in the extension:** The extension performs QR generation locally. It has no content script, extension storage, background service worker, analytics, telemetry, backend, or network requests, and it does not fetch or execute remote code. Brownsmith Dynamics does not receive your page URL or QR image. If you choose Share, Chrome or your operating system's native share interface receives the image and full URL so you can choose where to send them. Downloaded and copied images can contain the full URL and may persist in the apps or locations you choose. Chrome, your operating system, and other apps handle data under their own privacy practices.

For details, read the [Page QR Privacy Policy](https://plugins.brownsmithdynamics.com/page-qr/privacy/). This policy URL is planned and is not yet live or verified. Publish and verify it before using this description in the store.

## Single purpose

Create a QR code for the active HTTP or HTTPS page URL and let the user preview, download, copy, or optionally share that image.

## Permission justification for the dashboard

**`activeTab`** — Page QR reads the active tab's URL after the user invokes the extension so it can encode that exact URL in a QR code. This permission is limited to the current tab and supports the extension's single purpose. The extension does not request broad host access.

## Remote code

Page QR does not use remote code. Its JavaScript and QR encoder are packaged with the extension; it does not fetch executable code from a server.

## Data handling statement for the listing/dashboard

Page QR locally accesses and processes the active tab's URL to create the requested QR code. This local access is browsing information handling and is disclosed here and in the privacy policy. Brownsmith Dynamics receives no page URL, page content, QR image, clipboard content, or share-recipient information. The extension makes no network requests. A user-selected native share action passes the full URL and image to the browser or operating-system sharing interface; that interface and any selected destination may handle the data under their own policies.

For the Chrome Web Store Privacy practices form, answer based on the shipped build and these disclosures. In particular, distinguish data processed locally by the extension from data collected or received by the developer. Do not mark browsing activity as absent from all extension handling merely because it stays local.

## Configured listing links

- Homepage: https://plugins.brownsmithdynamics.com/page-qr/
- Privacy policy: https://plugins.brownsmithdynamics.com/page-qr/privacy/
- Support: https://plugins.brownsmithdynamics.com/support/
- Publisher attribution: https://brownsmithdynamics.com/
- Publisher contact: contact@brownsmithdynamics.com.

These are the configured subdomain URLs, including while DNS activation is pending.
The extension's `homepage_url` uses the product homepage above. Chrome's manifest
has no support URL field; use the Support URL dashboard field and `LISTING_URLS.json`.
Public access without ChatGPT sign-in must be verified before submitting the listing.

## Description files

`DESCRIPTION_3000_WORDS.md` contains the requested extended description.
`DESCRIPTION_STORE.txt` is the shorter version prepared for the store listing.

## Official references

- [Chrome Web Store User Data FAQ and Limited Use requirements](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Complete your Chrome Web Store listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Supplying Chrome Web Store images](https://developer.chrome.com/docs/webstore/images)
