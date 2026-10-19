# Privacy Policy — Page QR

**Draft for publication**  
**Effective date:** 18 October 2026  
**Publisher:** Brownsmith Dynamics  
**Contact:** [contact@brownsmithdynamics.com](mailto:contact@brownsmithdynamics.com)

Page QR creates a QR code from the complete HTTP or HTTPS address of the active browser tab. This policy describes the extension's handling of that address and of the image it creates.

## Information accessed and processed

When you open Page QR, Chrome's `activeTab` permission lets the extension read the active tab's URL after you invoke the extension. The extension uses that URL locally in the popup to create and preview a QR code. The encoded address is complete and may include a path, query parameters, and a fragment. A URL can itself contain personal, account, or other sensitive information, so review it before sharing the QR image.

This is local access and processing of browsing information. Page QR does not collect or transmit the URL to Brownsmith Dynamics. It does not use a content script, extension storage, a background service worker, an analytics or telemetry service, or a backend. The QR encoder is bundled with the extension; the extension does not fetch or execute remote code. The URL and generated image are held in popup memory while the popup is open and are discarded when that popup closes.

## Actions you choose

If you choose **Download PNG**, Chrome saves an image containing the QR code and a `[BD] Brownsmith Dynamics` footer. If you choose **Copy image**, the image is placed on the system clipboard. If the browser supports file sharing, **Share** opens the browser or operating system's native share interface and provides the PNG and the complete URL as share text. These actions can make the URL available outside the extension. A downloaded file, clipboard content, or copy held by another app may remain available according to that app, operating system, or your own settings. Brownsmith Dynamics does not receive these files or the URL through these actions.

## Information shared with the publisher

Brownsmith Dynamics receives no page URL, page content, QR image, clipboard content, or share recipient information from Page QR. The extension makes no network requests for its QR feature. Chrome and the browser, operating system, clipboard, download destination, or sharing apps may handle information under their own services and privacy practices; this policy does not describe their handling.

## Data retention and choices

The extension does not keep a history or persist the URL or QR image in extension storage. Close the popup to discard its in-memory copy. You control whether to download, copy, or share the image. You can remove the extension through Chrome's extension settings. Removing the extension does not delete files, clipboard entries, or content already sent to another app.

## Chrome Web Store Limited Use disclosure

Page QR's use and transfer of information received through Chrome APIs complies with the Chrome Web Store User Data Policy, including the Limited Use requirements. The extension accesses the active tab URL only to provide its single purpose: creating a QR code for that page. It does not transfer that URL to Brownsmith Dynamics or another party. When you explicitly choose a browser or operating-system share action, the extension provides the URL and image to that native sharing interface for delivery to the destination you select. The publisher does not use or transfer user data for personalized, retargeted, or interest-based advertising, and does not allow people to read user data.

## Changes and contact

If the extension's data practices change, this policy will be updated before or alongside the relevant release. For privacy questions, contact [contact@brownsmithdynamics.com](mailto:contact@brownsmithdynamics.com).

**Planned public policy URL:** https://plugins.brownsmithdynamics.com/page-qr/privacy/  
This URL is planned and has not been published or verified as live. Do not submit it as the public policy URL until it is reachable without sign-in and serves this policy.

## Chrome Web Store references

- [Chrome Web Store User Data FAQ and Limited Use requirements](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Complete your Chrome Web Store listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Supplying Chrome Web Store images](https://developer.chrome.com/docs/webstore/images)
