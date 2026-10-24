# Page QR store assets

- `screenshot-01-generate.jpg`: 1280 × 800, full-page URL to generated QR.
- `screenshot-02-download.jpg`: 1280 × 800, subdomain/path/query/fragment preserved,
  captured after clicking the real popup's Download PNG control.
- `logo-128.png`: 128 × 128 store logo with alpha; editable master at `../icons/page-qr.svg`.
- `logo-512.png`: retained larger source export.
- `marquee-1400x560.png`: 1400 × 560 marquee promotional tile.
- `small-promo-440x280.png`: 440 × 280 small promotional tile.
- `../icons/icon-128.png`: 128 × 128 store/manifest icon, including transparent padding.
- `DESCRIPTION_3000_WORDS.md`: exactly 3,000 whitespace-separated words, including
  headings and URL references.
- `DESCRIPTION_STORE.txt`: concise plain-text alternative for the listing field.
- `LISTING_URLS.json`: configured homepage, support, privacy and attribution URLs.

## Screenshot provenance

The screenshots show the actual production `popup.html`, `popup.css`, `popup.js`
and bundled encoder running in a controlled browser demonstration. An external
capture-only shim supplies a labelled example tab URL through `chrome.tabs.query`.
The displayed QR codes, action buttons, branding and download feedback are rendered
by production code. The screenshots include promotional framing and do not depict
an installed extension's native Chrome toolbar popup. They are not evidence of a
full installed-extension acceptance test. No production source is replaced by the shim.

Reproduce by running `node scripts/serve-captures.cjs`, opening `/capture/01` and
`/capture/02` at its printed loopback address, and capturing a 1280 × 800 viewport.
For the second image, click Download PNG in the iframe first. Browser captures
are JPEG; no editing, upscaling or synthetic action feedback was applied.

## Logo source

This is a deterministic vector design extending BD's `[BD]` branding and a QR
finder motif. It is a decorative brand mark rather than a functional QR code.
No image-generation model was used. Run `node scripts/generate-icons.cjs` with
`sharp` available through normal Node resolution, `NODE_PATH`, or `SHARP_MODULE`.
The 128px icon has 96px artwork and 16px transparent margins on each side.

## Promotional tiles

Both tiles use the existing Page QR vector logo and Brownsmith Dynamics colors.
Editable SVG canvases are in `promo-source/`. Reproduce the PNGs with
`node scripts/generate-promos.cjs` and `sharp` available through normal Node
resolution, `NODE_PATH`, or `SHARP_MODULE`. These are marketing images, not
functional QR codes or screenshots of the extension.

## Store links

Use the subdomain URLs in `LISTING_URLS.json`, including during DNS activation.
The homepage is also configured in the extension manifest. Public access without
authentication still needs verification before submission.

## Verification

`node tests/verify.cjs` checks extension behavior. `node scripts/verify-store-assets.cjs`
checks image dimensions, word count, required attribution references, icon paths
and configured URLs.

Official graphic guidance: https://developer.chrome.com/docs/webstore/images
