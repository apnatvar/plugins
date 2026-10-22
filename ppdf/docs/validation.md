# Validation

Run `npm run build`, then `npm test`, then `npm run package` from `ppdf/`. The production validator runs during build and packaging. No test fixtures or development tools are packaged.

The Node suite uses generated documents to check merge, range splitting, extraction, deletion, reordering, rotation, numbering, searchable text, JPEG replacement, image conversion, unsupported image dictionaries, malformed documents, encrypted documents, and invalid selections. The JPEG replacement fixture contains valid image data with redundant comment bytes; output integrity is checked with pdf-lib and text extraction with PDF.js.

The browser suite loads the built Manifest V3 extension in an isolated headless Chromium profile. It tests all nine tools through real workers and the workspace, all three presets using browser JPEG encoding, mixed text/image and scanned-only PDFs, text preservation, drag-and-drop order, keyboard-accessible move controls, large page preview, cancellation, downloads, exact original-byte fallback when serialization grows a PDF, malformed/encrypted input errors, and popup-to-tab navigation. The context stays offline while processing; outbound HTTP/WebSocket requests and JavaScript runtime errors fail the suite. The generated noisy-image fixture exercises measurable reduction, rather than assuming every PDF will compress.

Local run on 22 October 2026: 15 core tests passed; Chromium workflows and production validation passed. Generated screenshots and example downloads are in the ignored `test-results/` directory. This is generated-fixture coverage, not a compatibility claim for every PDF producer, unusual color space, or document-level interactive feature.
