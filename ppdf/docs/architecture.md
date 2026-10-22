# Architecture

PPDF is a Manifest V3 Chrome extension. Its user interface runs locally, and PDF work is performed on-device. The extension requests no browser permissions. The application has no upload or remote conversion service.

## Compression path

Compression inspects supported PDF image streams and only transforms eligible JPEG (`DCTDecode`) image data in `DeviceRGB`. It decodes an image, applies preset-dependent resizing when appropriate, and re-encodes it as JPEG in an `OffscreenCanvas` worker. PDF text and vector drawing commands remain PDF objects; the page is never rendered to a bitmap for compression.

The `high`, `balanced`, and `smallest` presets represent progressively stronger image reduction. A conversion is kept only when it succeeds and is beneficial. Unsupported filters, color spaces, image forms, or failed conversions produce a warning and retain the original image data. Compression is best-effort and may not reduce every file; malformed or encrypted PDFs are rejected.

The worker isolates the canvas conversion workload from the UI. File bytes stay in the local extension context. No document data is sent over the network.

## Page operations

The PDF operation layer accepts one or more named byte arrays and returns named PDF outputs plus warnings. It supports merging, splitting, extracting, deleting, reordering, rotating pages, creating a PDF from JPG/PNG input images, and adding page numbers. Image inputs are limited to 40 megapixels and 100 MB each. Page indices are zero-based in the API; the interface should present human-friendly one-based page numbers and translate at its boundary. Split ranges are comma-separated page ranges.

Page-oriented rewrites can change or omit document-level structures that are not attached directly to copied pages. Forms, outlines, attachments, metadata, layers, and digital signatures are not guaranteed to survive reliably. Encrypted inputs are rejected. Processing large PDFs can consume significant memory; inputs and intermediate document data may coexist while an operation runs.

## Deferred work

Batch compression, OCR, and a full PDF editor are outside the current scope. They can be considered later without adding remote processing to the privacy model.
