# PPDF

**PPDF — Privacy PDF** is an offline PDF toolkit for Chrome, by **[BD](https://brownsmithdynamics.com)**. It runs locally in the browser and requests zero extension permissions. PPDF does not upload your documents to a server.

Project and product information: [plugins.brownsmithdynamics.com](https://plugins.brownsmithdynamics.com) · [brownsmithdynamics.com](https://brownsmithdynamics.com)

## Features

- Compress PDFs with conservative, balanced, or smallest presets.
- Merge files, split selected page ranges, extract or delete pages, reorder pages, and rotate pages.
- Create a PDF from JPG and PNG images and add page numbers.
- Keep text and vector artwork as PDF objects during compression. Compression targets supported JPEG image streams: decode DCT/JPEG images, optionally downsample, and re-encode through `OffscreenCanvas` in a worker. Pages are not rasterized.
- Preserve the original image when compression does not support it, conversion fails, or the re-encoded image is not smaller.

Compression is intentionally conservative. It does not promise a smaller file: PDFs with little eligible image data may remain the same size or grow slightly. PDF document-level features, including forms, outlines, attachments, metadata, layers, and digital signatures, may not be preserved reliably by page operations. Encrypted PDFs are rejected. Large documents can require substantial memory because processing happens locally.

JPG and PNG inputs are limited to 40 megapixels per image and 100 MB per file. Full dependency licence texts are included in `dist/licenses/` and in the distributable archive; see [licensing details](docs/licensing.md) and the generated [third-party licence inventory](THIRD_PARTY_LICENSES.md).

The compression implementation does not use Ghostscript. Its AGPL/commercial licensing model is not suitable for this project; see [Ghostscript licensing](https://ghostscript.com/licensing/) and its [FAQ](https://ghostscript.com/faq/). This project also retains attribution to the original site references: [plugins.brownsmithdynamics.com](https://plugins.brownsmithdynamics.com) and [brownsmithdynamics.com](https://brownsmithdynamics.com).

## Development

Requires Node.js 22.13 or later and npm.

```sh
npm ci
npm run dev
npm run build
npm run check
npm test
npm run package
```

`npm run dev` starts Vite; open `/workspace.html` to work on the UI (the popup's Chrome API requires loading the extension). `build` creates the production extension in `dist/` and validates its Manifest V3 configuration and local executable assets. `check` runs TypeScript checks; `test` runs the Node tests and an offline Chromium extension suite; `package` creates `artifacts/ppdf-0.1.0.zip` from the production build. Build before running tests or packaging. Generated dependencies, builds, browser profiles, and archives are excluded from Git.

The browser portion of `npm test` requires Chromium. Install Playwright's Chromium with `npx playwright install chromium`, or set `PPDF_CHROMIUM` to an existing Chromium executable before running the tests.

## Install the built extension

1. Run `npm run build`.
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Choose **Load unpacked** and select this project's `dist/` directory.
4. Pin PPDF and click its icon. A tool opens the workspace in its own extension tab, so closing the popup does not interrupt processing. For the ZIP, extract it first and load the extracted folder containing `manifest.json`.

See [validation coverage](docs/validation.md), [architecture](docs/architecture.md), and [privacy](docs/privacy.md).

## Scope

Batch compression, OCR, and a full PDF editor are deferred. The current goal is a small, local toolkit with transparent limits and safe fallbacks for content it cannot transform.
