# Page QR — Extended Description

## A direct way to carry a page address

Page QR is a Chrome extension from Brownsmith Dynamics that turns the address of the page you are viewing into a scannable QR code. Open the extension from Chrome's toolbar on an HTTP or HTTPS page, and the popup reads that tab's current URL, creates the code, and shows a preview. You can then download the image, copy it, or use a native file-sharing option when the browser supports that action. The image has a small [BD] Brownsmith Dynamics footer below the square code.

The purpose is deliberately narrow: make the current web address easier to pass from one screen to another. A person can scan the image with a phone instead of retyping a long link, or you can put the saved PNG into a document, message, slide, or handout. The QR code represents the address itself. Page QR does not host a page, shorten a link, create a redirect, or change what a recipient is allowed to see.

## What the code contains

Page QR encodes the full URL read from the active tab. That includes the protocol, hostname, any subdomain, the path, query parameters, and fragment when present. For example, the address https://portal.example.com/catalog/item?source=event#details is encoded as that complete address, including its query and fragment. A URL for a subpage is not replaced with the site's home page, and a subdomain is not dropped. Page QR does not edit, normalize, or shorten the URL before encoding it.

That completeness is useful when a link identifies a particular article, product, form, or view. It also means the QR image may contain information embedded in the URL. Some services put session identifiers, invitation codes, search terms, or other private values in a query string. A fragment may identify a location within a page or carry application state. Inspect the displayed address before you share the QR. Anyone who can scan the image can read and try to open the URL it contains.

The code is a representation of the address, not a copy of the page. It does not include page text, images, account credentials stored by a website, or browser cookies. It does not make a private page public. If a page requires a login, permission, network connection, or a particular device, a recipient still needs those things. A QR code cannot grant access that the recipient does not already have.

## A short workflow

Visit the HTTP or HTTPS page you want to pass along. Wait for it to finish loading if you want to use the final address after a redirect, then click the Page QR toolbar button. The popup shows the URL and builds a QR preview locally. Review the address in the popup, especially if the link came from a personal, administrative, or account page. Choose Download PNG to save an image, or Copy image to place it on the clipboard. If Share is visible, it can open the browser or operating system's native sharing interface with the PNG and the URL as share text.

After saving or copying, use the PNG in the destination you choose. For a printed handout, place it with enough space around the code and test a print at the size you intend to use. For a presentation, keep the code large and sharp enough for the audience's distance. Page QR supplies the image; the layout, print quality, display brightness, viewing distance, and scanner determine whether a particular copy is easy to scan. Check the actual exported or printed result with a phone before distributing it.

## Preview and image actions

The popup preview lets you see which page address is being encoded before you act. The QR image is a PNG and includes a four-module white quiet zone around the code, plus the small publisher footer below it. The footer sits outside the square code area and its quiet zone. It is part of the generated image for the preview, the downloaded file, the copied image, and a supported share action. The footer identifies Brownsmith Dynamics; it does not change the URL encoded by the code.

Download PNG saves the image as page-qr.png through Chrome's normal download behavior. The extension creates the image in the popup, triggers a browser download, and releases its temporary object URL. Where downloads are managed or restricted by the browser or device, those browser settings apply. The file can be renamed or moved using the tools on your device. Page QR does not send the file to a remote account or keep a library of generated codes.

Copy image writes the PNG image to the clipboard when the browser exposes compatible clipboard image support and the action succeeds. The copied item is an image, not a text-only URL. You can paste it into an application that accepts clipboard images. Some browser contexts or destination applications do not support image pasting. If copying is unavailable or fails, use Download PNG and attach the saved image yourself. Clipboard contents may remain available according to your operating system and other applications, even after the popup closes.

Share is shown only when the browser reports support for sharing files. The control passes the PNG and the full URL as share text to the native sharing interface. From there you choose an available destination. That interface can offer different destinations on different devices and may be absent in a browser that does not support file sharing. A share sheet closing or a share action failing does not mean Page QR has delivered the image. The browser, operating system, and selected destination handle their own sharing behavior and privacy.

## Local processing and permissions

Page QR asks for Chrome's activeTab permission. Chrome grants access to the active tab in response to the user invoking the extension, allowing the popup to read that page's address for its stated purpose. The extension does not ask for broad access to all websites, all tabs, or page contents. It does not inject a content script into the page. It does not run a background service worker or keep an extension storage history.

QR generation runs inside the popup using the encoder packaged with the extension. The extension's page policy disables network connections, and the QR feature makes no backend requests, analytics calls, or telemetry transmissions. The publisher does not receive the page URL or the QR image from this process. The URL and image are held in popup memory while the popup is open and are discarded when it closes. If you choose to share, the extension provides the image and URL to the native sharing interface you invoked; the selected service then operates under its own practices. Downloaded files, clipboard contents, and content pasted or sent elsewhere are outside the popup's temporary memory.

These details describe Page QR's extension behavior. Chrome, your operating system, the download destination, clipboard manager, browser sync, or another app may have separate features or data practices. Page QR does not control those systems. If you want the URL to remain within a trusted group, choose a destination and sharing method that suit that requirement, and confirm that all recipients should be able to see the address.

## Supported pages and limits

Page QR accepts active page URLs whose protocol is HTTP or HTTPS. Browser-internal pages, extension pages, local file addresses, and other non-web schemes cannot be turned into a QR code by this extension. If the current tab does not expose a URL, or Chrome does not make it available, the popup displays an error. Open a regular website and invoke the extension again.

A URL can be too long for the QR encoder's capacity. A long address may include many query parameters or a large token, and there is a finite amount of data a QR code can hold. When the encoder reports that the address will not fit, Page QR displays an error instead of creating a code for a different or shortened address. It does not silently remove parameters, truncate a path, or send the URL to a shortening service. If your service offers a safe shorter canonical link, obtain that link from the service itself and inspect it before encoding.

Scanning quality depends on both the URL length and the image's eventual use. Dense codes have smaller individual modules when displayed at a fixed image size. A messaging app may resize an image, a document may compress it, and a printer may blur fine detail. Page QR preserves integer-sized modules in its PNG, but cannot control later resizing, compression, printing, screen glare, camera focus, or scanner behavior. For important distribution, test the exact image in the intended setting and retain a readable text link as a fallback.

## Reading the address with care

The complete URL can be more than a location. Web services sometimes place a temporary access token, email address, account identifier, search query, or invitation code in the address. Those values can remain visible in a QR image even if the page itself displays no sensitive information. Inspect the URL in the popup and decide whether the image can be shown to everyone in the room, attached to a public document, or forwarded through a group chat.

A URL in a QR image is not hidden behind encryption. QR encoding changes how the characters are represented visually; it does not conceal them from a scanner. Anyone with a QR reader can decode the address. If the link grants access because it contains a bearer token or one-time credential, anyone with the image may be able to use it until the service expires or revokes it. Page QR does not identify such links, assess their risk, or remove their sensitive values.

If the page is private, recipients still need the right account and permissions. A QR is not a sign-in transfer. It does not include saved passwords, browser cookies, authentication headers, or other state from your current session. A link that works for you may display a login page or an access-denied message for someone else. When sharing with a group, confirm the destination's sharing settings separately and use the service's own access controls.

For links you do not intend to share broadly, consider whether the service offers a public page, a dedicated share link with appropriate controls, or another approved distribution method. Do not use Page QR to turn a private address into an assumed public link. The extension faithfully encodes the URL it receives; it cannot determine whether the destination owner intended that address for redistribution.

## Accuracy and troubleshooting

If the preview does not appear, first confirm that the current tab is a regular HTTP or HTTPS website. Chrome restricts extensions from reading some browser-managed pages. A blank, loading, or protected tab may also have no available address at the moment you open the popup. Close the popup, load the website, and invoke Page QR again. If the problem persists, note your Chrome version and operating system for support, without including a private URL.

If the QR cannot be generated because the URL is too long, look at the address for long query strings or other data. Page QR will not trim them because doing so could change where the link points or break its intended behavior. If a shorter URL is appropriate, use the page provider's own link-sharing or canonical-link feature, then open and review that result. Do not assume a shortened or altered address preserves the same access rules.

If a code scans inconsistently, use the original downloaded PNG and avoid shrinking it excessively. Keep the white space around the square intact. Avoid placing decorative graphics over the code or using a low-contrast background in the design where you use it. The extension's PNG has a white background and a four-module quiet zone, but a later editor can crop or cover them. Test the version a recipient will actually see or scan.

If Copy image reports that it is unavailable, the browser may not offer clipboard image writing in the current popup or operating system. Try again in a supported context, or download the PNG and insert it into the destination application. If Download PNG does not behave as expected, check Chrome's download settings, available disk space, and any device policy controlling downloads. Page QR cannot change browser or administrator settings.

If Share is missing, the current browser does not report a supported file-sharing capability. If the share sheet opens but a destination is absent, that destination may not be configured on the device. Use the PNG download and your preferred sharing app. If you cancel a share sheet, the extension treats that as a user cancellation and does not report a completed share.

## Frequently asked questions

**Does the QR open the same page?** It points to the full active HTTP or HTTPS URL at the time Page QR reads it. What happens after scanning depends on the URL, the scanner, the browser, the site's availability, and the recipient's access. A site may redirect, require sign-in, or change over time.

**Does it include paths and query strings?** Yes. Page QR encodes the URL it reads, including subdomains, paths, query parameters, and fragments. The full address is also displayed in the popup. Review it before sharing, especially when the address was generated by an account or invitation workflow.

**Can I create a QR code for a local file or Chrome settings page?** No. The extension supports HTTP and HTTPS URLs. Chrome and other browsers restrict access to internal pages, and local file addresses are outside this extension's supported scope.

**Will a private page become public?** No. A QR code only carries an address. It does not change the destination's permissions, transfer your account session, or create access for a recipient. The recipient must satisfy the site's access requirements.

**Does Page QR shorten or track links?** No. It encodes the complete address that Chrome makes available and does not make a redirect, link shortener, scan counter, or analytics record. The destination website may have its own tracking behavior.

**Does the extension send my URL to Brownsmith Dynamics?** No. The extension processes the URL locally in its popup and makes no network requests for the QR feature. Brownsmith Dynamics does not receive the URL or generated image from Page QR. If you choose native sharing, the browser or operating system receives the image and URL so that you can select a destination.

**Why does the image have a footer?** The PNG includes a small [BD] Brownsmith Dynamics footer below the QR square. It identifies the publisher and stays outside the code and its white quiet zone. The footer is part of the image in the preview, download, copy, and supported share actions.

**Can I edit the image?** You can use image-editing or document tools on the downloaded PNG. Keep the QR modules, contrast, and quiet zone intact, and scan the result before distributing it. Page QR does not check changes made after export.

**Why is Share not always shown?** The extension displays Share only when the browser supports sharing files in the current environment. Download and copy are separate options. Copy image also depends on clipboard image support.

**What if a URL is too long?** The popup shows an error when the encoder cannot fit the URL. It does not remove content or silently encode a different address. Obtain a shorter suitable URL from the site itself if one is available, then review that link.

**Does Page QR need an account?** No publisher account or sign-in is required to generate a code. A website reached by scanning may still require an account or authorization.

**Does the extension store previous codes?** No. The popup uses in-memory data for the current image. It does not keep a code history in extension storage. A file you download, an image you copy, or data passed to another app may remain in those locations under their controls.

## Preparing an image for other people

When placing a QR image in a document, add a short text label explaining what the scan opens. A label gives people context before they point a camera at the code and helps distinguish it from neighboring codes. If the destination has a readable short link, include that address as text too. This gives someone another way to reach the page when scanning is inconvenient, the camera is unavailable, or the image has been reduced in size. Keep the destination page's title or purpose accurate in the label, and avoid suggesting that the code performs an action beyond opening its URL.

Think about the audience and setting before displaying a code. Page QR does not expire an image or update a saved copy when the address changes. If the link needs to be replaced, create and distribute a new image from the new address, then remove old copies where you can.

## Publisher and references

Page QR is published by Brownsmith Dynamics. The publisher website is https://brownsmithdynamics.com and the plugins site is https://plugins.brownsmithdynamics.com/. The product page is https://plugins.brownsmithdynamics.com/page-qr/ and the product documentation is https://plugins.brownsmithdynamics.com/page-qr/. The privacy information is at https://plugins.brownsmithdynamics.com/page-qr/privacy/ and support is at https://plugins.brownsmithdynamics.com/support/. These URLs are provided as reference addresses; their live availability has not been verified here. For support, include your Chrome version, operating system, and a description of the issue. Do not include an account URL or QR image unless you have checked that it contains no sensitive information.

Page QR has a single focused job: encode the current web address as a QR image that you can preview and choose how to use. It reads the active HTTP or HTTPS URL after you invoke it, retains its full path and parameters, and generates the image locally. You decide whether to save, copy, or share that image. The URL continues to work according to the destination site's availability and access rules. Review the address and the sharing context, then use the code where a scannable route to that page is useful.
