import { imageFileType, readImageDimensions } from './validation';
import {
  degrees,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFImage,
  PDFRawStream,
  StandardFonts,
  rgb,
} from 'pdf-lib';

export type PdfOperation = 'compress' | 'merge' | 'split' | 'extract' | 'delete' | 'reorder' | 'rotate' | 'images' | 'number';
export type CompressionPreset = 'high' | 'balanced' | 'smallest';
export interface PdfInputFile { name: string; bytes: Uint8Array }
export interface PdfRequest {
  operation: PdfOperation;
  files: PdfInputFile[];
  /** Zero-based indexes. For reorder, this is the complete new page order. */
  pages?: number[];
  /** One-based comma-separated page groups, for example "1-3,5,7-9". */
  ranges?: string;
  /** Zero-based page index to clockwise angle to add. */
  rotations?: Record<number, number>;
  preset?: CompressionPreset;
}
export interface PdfResult { files: { name: string; bytes: Uint8Array }[]; warnings: string[] }
export type ProgressReporter = (value: number) => void;

export type PdfImageEncoder = (source: Uint8Array, width: number, height: number, quality: number, maxDimension: number) => Promise<{ bytes: Uint8Array; width: number; height: number }>;

const n = (value: number) => PDFNumber.of(value);
const name = (value: string) => PDFName.of(value);
function objectNumber(obj: unknown): number | undefined {
  return obj instanceof PDFNumber ? obj.asNumber() : undefined;
}
function nameValue(obj: unknown): string | undefined {
  return obj instanceof PDFName ? obj.decodeText() : undefined;
}
function lookup(dict: PDFDict, key: string): unknown {
  try { return dict.lookup(name(key)); } catch { return undefined; }
}
function getFilter(stream: PDFRawStream): string | undefined {
  let filter = lookup(stream.dict, 'Filter');
  if (filter instanceof PDFArray) {
    if (filter.size() !== 1) return undefined;
    filter = filter.get(0);
  }
  return nameValue(filter);
}
function hasKey(dict: PDFDict, key: string): boolean { return dict.has(name(key)); }

async function loadPdf(file: PdfInputFile): Promise<PDFDocument> {
  if (!(file.bytes instanceof Uint8Array) || file.bytes.length < 8 || new TextDecoder().decode(file.bytes.subarray(0, 8)).indexOf('%PDF-') < 0) {
    throw new Error(`“${file.name}” is not a valid PDF.`);
  }
  try {
    return await PDFDocument.load(file.bytes, { ignoreEncryption: false, throwOnInvalidObject: true, updateMetadata: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/encrypt|password|encrypted/i.test(message)) throw new Error(`“${file.name}” is encrypted or password-protected.`);
    throw new Error(`Could not read “${file.name}”: ${message}`);
  }
}
function validateRequest(request: PdfRequest): void {
  if (!request || !['compress', 'merge', 'split', 'extract', 'delete', 'reorder', 'rotate', 'images', 'number'].includes(request.operation)) throw new Error('Choose a supported PDF operation.');
  if (!Array.isArray(request.files) || request.files.length === 0) throw new Error('Select at least one PDF file.');
  if (request.operation !== 'merge' && request.operation !== 'images' && request.files.length !== 1) throw new Error('This operation accepts one PDF at a time.');
  if (request.operation === 'merge' && request.files.length < 2) throw new Error('Select at least two PDFs to merge.');
}
function checkedPages(pages: number[] | undefined, count: number, allowEmpty = false): number[] {
  if (!Array.isArray(pages) || (!allowEmpty && pages.length === 0)) throw new Error('Enter at least one page number.');
  const used = new Set<number>();
  for (const page of pages) {
    if (!Number.isInteger(page) || page < 0 || page >= count) throw new Error(`Page indexes must be between 0 and ${count - 1}.`);
    if (used.has(page)) throw new Error('A page cannot be selected more than once.');
    used.add(page);
  }
  return pages;
}
function parseRanges(spec: string | undefined, count: number): number[][] {
  if (!spec?.trim()) throw new Error('Enter page ranges such as 1-3,5.');
  return spec.split(',').map((raw) => {
    const part = raw.trim();
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!match) throw new Error(`Invalid page range “${part}”. Use one-based page numbers like 1-3,5.`);
    const first = Number(match[1]), last = Number(match[2] ?? match[1]);
    if (first < 1 || last < first || last > count) throw new Error(`Page range “${part}” is outside this ${count}-page PDF.`);
    return Array.from({ length: last - first + 1 }, (_, i) => first - 1 + i);
  });
}
function outputName(input: string, suffix: string, extension = 'pdf'): string {
  const stem = input.replace(/\.pdf$/i, '') || 'document';
  return `${stem}-${suffix}.${extension}`;
}
async function copyPages(source: PDFDocument, indexes: number[], fileName: string, suffix: string): Promise<{ name: string; bytes: Uint8Array }> {
  const target = await PDFDocument.create();
  const copied = await target.copyPages(source, indexes);
  copied.forEach((page) => target.addPage(page));
  return { name: outputName(fileName, suffix), bytes: await target.save() };
}

/** Compresses only eligible JPEG image XObjects. Text, vectors, masks and other images stay intact. */
export async function compressPdfImages(
  document: PDFDocument,
  preset: CompressionPreset = 'balanced',
  encoder: PdfImageEncoder = encodeJpegInBrowser,
  warningSink: string[] = [],
): Promise<number> {
  const settings = preset === 'high' ? { quality: 0.84, maxDimension: 3600 } : preset === 'smallest' ? { quality: 0.52, maxDimension: 1500 } : { quality: 0.68, maxDimension: 2400 };
  let changed = 0;
  for (const [ref, object] of document.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream) || getFilter(object) !== 'DCTDecode') continue;
    const dict = object.dict;
    if (nameValue(lookup(dict, 'Subtype')) !== 'Image') continue;
    const width = objectNumber(lookup(dict, 'Width')), height = objectNumber(lookup(dict, 'Height'));
    const bits = objectNumber(lookup(dict, 'BitsPerComponent'));
    const color = nameValue(lookup(dict, 'ColorSpace'));
    if (width === undefined || height === undefined || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height > 40_000_000) {
      warningSink.push('Skipped an image with invalid dimensions or more than 40 megapixels.');
      continue;
    }
    if (bits !== 8 || color !== 'DeviceRGB' || hasKey(dict, 'DecodeParms') || ['Decode', 'SMask', 'Mask', 'ImageMask', 'Alternates'].some((key) => hasKey(dict, key))) {
      warningSink.push('Skipped an image that uses a mask, alternate image, decode parameters, or unsupported color format.');
      continue;
    }
    try {
      const encoded = await encoder(object.contents, width, height, settings.quality, settings.maxDimension);
      if (encoded.bytes.length >= object.contents.length) continue;
      const nextDict = dict.clone(document.context);
      nextDict.set(name('Width'), n(encoded.width));
      nextDict.set(name('Height'), n(encoded.height));
      document.context.assign(ref, PDFRawStream.of(nextDict, encoded.bytes));
      changed++;
    } catch {
      warningSink.push('Skipped an image the browser could not decode; the original image was preserved.');
    }
  }
  return changed;
}

async function encodeJpegInBrowser(source: Uint8Array, width: number, height: number, quality: number, maxDimension: number): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') throw new Error('Browser image encoding is unavailable.');
  const bitmap = await createImageBitmap(new Blob([source.slice().buffer as ArrayBuffer], { type: 'image/jpeg' }));
  try {
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const outWidth = Math.max(1, Math.round(width * scale)), outHeight = Math.max(1, Math.round(height * scale));
    const canvas = new OffscreenCanvas(outWidth, outHeight);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create an image canvas.');
    context.drawImage(bitmap, 0, 0, outWidth, outHeight);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width: outWidth, height: outHeight };
  } finally {
    bitmap.close();
  }
}

async function imagesToPdf(files: PdfInputFile[], progress?: ProgressReporter): Promise<PdfResult> {
  const target = await PDFDocument.create();
  const maxPageWidth = 612, maxPageHeight = 792, margin = 36;
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    let image: PDFImage;
    try {
      if (!(file.bytes instanceof Uint8Array) || file.bytes.length > 100 * 1024 * 1024) throw new Error('Image is missing or exceeds the 100 MB file limit.');
      const type = imageFileType(file);
      readImageDimensions(file.bytes, type);
      image = type === 'jpg' ? await target.embedJpg(file.bytes) : await target.embedPng(file.bytes);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Could not read image “${file.name}”: ${detail}`);
    }
    const imageSize = image.scale(1);
    if (!Number.isFinite(imageSize.width) || !Number.isFinite(imageSize.height) || imageSize.width <= 0 || imageSize.height <= 0 || imageSize.width * imageSize.height > 40_000_000) {
      throw new Error(`“${file.name}” has invalid or oversized image dimensions. Choose images under 40 megapixels.`);
    }
    const landscape = imageSize.width > imageSize.height;
    const pageWidth = landscape ? maxPageHeight : maxPageWidth;
    const pageHeight = landscape ? maxPageWidth : maxPageHeight;
    const scale = Math.min((pageWidth - margin * 2) / imageSize.width, (pageHeight - margin * 2) / imageSize.height);
    const width = imageSize.width * scale, height = imageSize.height * scale;
    const page = target.addPage([pageWidth, pageHeight]);
    page.drawImage(image, { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height });
    progress?.(20 + Math.round((index + 1) / files.length * 75));
  }
  const firstStem = files[0].name.replace(/\.[^.]*$/, '') || 'images';
  return { files: [{ name: `${firstStem}-images.pdf`, bytes: await target.save() }], warnings: [] };
}

export async function processPdf(request: PdfRequest, progress?: ProgressReporter): Promise<PdfResult> {
  validateRequest(request);
  const warnings: string[] = [];
  const report = (value: number) => progress?.(Math.max(0, Math.min(100, Math.round(value))));
  report(2);
  if (request.operation === 'images') {
    const result = await imagesToPdf(request.files, report);
    report(100);
    return result;
  }
  const loaded: PDFDocument[] = [];
  for (let i = 0; i < request.files.length; i++) {
    loaded.push(await loadPdf(request.files[i]));
    report(4 + Math.round((i + 1) / request.files.length * 16));
  }
  const file = request.files[0];
  const pdf = loaded[0];
  const pageCount = pdf.getPageCount();
  if (pageCount === 0) throw new Error('This PDF has no pages.');
  warnings.push('Saving this modified PDF can invalidate existing digital signatures.');
  let files: PdfResult['files'] = [];

  switch (request.operation) {
    case 'merge': {
      warnings.push('Copied pages may not retain bookmarks, form fields, attachments, or document metadata.');
      const target = await PDFDocument.create();
      for (let i = 0; i < loaded.length; i++) {
        const pages = await target.copyPages(loaded[i], loaded[i].getPageIndices());
        pages.forEach((page) => target.addPage(page));
        report(20 + Math.round((i + 1) / loaded.length * 72));
      }
      files = [{ name: outputName(file.name, 'merged'), bytes: await target.save() }];
      break;
    }
    case 'split': {
      warnings.push('Copied pages may not retain bookmarks, form fields, attachments, or document metadata.');
      const groups = parseRanges(request.ranges, pageCount);
      for (let i = 0; i < groups.length; i++) {
        files.push(await copyPages(pdf, groups[i], file.name, `part-${i + 1}`));
        report(20 + Math.round((i + 1) / groups.length * 72));
      }
      break;
    }
    case 'extract': {
      warnings.push('Copied pages may not retain bookmarks, form fields, attachments, or document metadata.');
      const pages = checkedPages(request.pages, pageCount);
      files = [await copyPages(pdf, pages, file.name, 'extracted')];
      break;
    }
    case 'delete': {
      warnings.push('Copied pages may not retain bookmarks, form fields, attachments, or document metadata.');
      const removed = new Set(checkedPages(request.pages, pageCount));
      const kept = pdf.getPageIndices().filter((index) => !removed.has(index));
      if (!kept.length) throw new Error('Deleting those pages would leave an empty PDF.');
      files = [await copyPages(pdf, kept, file.name, 'edited')];
      break;
    }
    case 'reorder': {
      warnings.push('Copied pages may not retain bookmarks, form fields, attachments, or document metadata.');
      const pages = checkedPages(request.pages, pageCount);
      if (pages.length !== pageCount) throw new Error('Reorder requires every page exactly once.');
      files = [await copyPages(pdf, pages, file.name, 'reordered')];
      break;
    }
    case 'rotate': {
      for (const [rawIndex, rotation] of Object.entries(request.rotations ?? {})) {
        const index = Number(rawIndex);
        if (!Number.isInteger(index) || index < 0 || index >= pageCount) throw new Error(`Rotation page index ${rawIndex} is outside this PDF.`);
        if (!Number.isInteger(rotation) || rotation % 90 !== 0) throw new Error('Rotation angles must be multiples of 90 degrees.');
        pdf.getPage(index).setRotation(degrees(((pdf.getPage(index).getRotation().angle + rotation) % 360 + 360) % 360));
      }
      files = [{ name: outputName(file.name, 'rotated'), bytes: await pdf.save() }];
      break;
    }
    case 'number': {
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      pdf.getPages().forEach((page, index) => {
        const label = String(index + 1);
        const crop = page.getCropBox();
        const angle = ((page.getRotation().angle % 360) + 360) % 360;
        const shortDimension = Math.max(0.1, Math.min(crop.width, crop.height));
        const margin = Math.max(0.1, Math.min(18, shortDimension * 0.04));
        const size = Math.max(0.1, Math.min(10, shortDimension * 0.04));
        const labelWidth = font.widthOfTextAtSize(label, size);
        let x = crop.x + crop.width - margin - labelWidth;
        let y = crop.y + margin;
        if (angle === 90) {
          x = crop.x + crop.width - margin;
          y = crop.y + crop.height - margin - labelWidth;
        } else if (angle === 180) {
          x = crop.x + margin + labelWidth;
          y = crop.y + crop.height - margin;
        } else if (angle === 270) {
          x = crop.x + margin;
          y = crop.y + margin + labelWidth;
        }
        page.drawText(label, { x, y, size, font, color: rgb(0.25, 0.25, 0.25), rotate: degrees(angle) });
      });
      files = [{ name: outputName(file.name, 'numbered'), bytes: await pdf.save() }];
      break;
    }
    case 'compress': {
      const warningCount = warnings.length;
      const changed = await compressPdfImages(pdf, request.preset ?? 'balanced', encodeJpegInBrowser, warnings);
      if (!changed && warnings.length === warningCount) warnings.push('No eligible JPEG images could be reduced; the PDF content was preserved.');
      files = [{ name: outputName(file.name, 'compressed'), bytes: await pdf.save() }];
      break;
    }
  }
  report(100);
  return { files, warnings: [...new Set(warnings)] };
}
