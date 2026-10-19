# Page QR

A small Chrome Manifest V3 extension that turns the current page address into
a QR code. Scan the preview, download a PNG, or copy the image into a message.
Native file sharing appears only when the browser supports it.
Every image includes a small **[BD] Brownsmith Dynamics** footer beneath the QR,
including downloaded, copied, and shared PNGs. The footer leaves the QR and its
white quiet zone intact.

## Install

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this `page-qr` folder.
4. Pin **Page QR** from the extensions menu. Visit a website and click its icon.

There is no build step, package installation, account, or backend.

## Privacy and behavior

- The QR contains the complete current HTTP or HTTPS URL, including its query
  parameters and fragment. Subpages and subdomains are preserved: for example,
  `https://portal.example.com/products/widget?ref=partner#specs` encodes that exact
  address. The extension never shortens or changes it.
- Generation runs locally using the bundled QR encoder. No telemetry, remote
  scripts, network requests, content scripts, storage, or background worker.
- The sole permission, `activeTab`, lets the popup read the page address when
  you click the extension. It does not request access to every browsing tab.
- Copying requires browser clipboard support and a focused popup. If unavailable,
  download the PNG instead. A native share dialog is optional.
- Browser/internal pages and non-web URLs are unsupported. Very long URLs may
  exceed QR capacity; the popup displays an error. Saved PNGs keep sharp integer
  modules and a four-module white quiet zone even for dense codes.
- A QR grants no extra access: recipients still need any required account or
  access to a private/local site. Anyone receiving the QR can read its full URL.

## Development

Plain HTML, CSS, and JavaScript. Reload the extension in `chrome://extensions`
after editing. `vendor/README.md` records the pinned encoder version and license.

Run automated checks with Node.js:

```sh
node tests/verify.cjs
```

The checks use a mocked popup environment. For real Chrome verification, open
a normal HTTPS page, scan the QR with a phone, compare its URL including query
and fragment, download the PNG, and paste the copied image into a compatible app.
Try an internal page and an oversized URL to inspect the error states.

## References

- [Chrome activeTab permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [QR encoder source](https://github.com/kazuhikoarase/qrcode-generator)
