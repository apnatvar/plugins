import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { compressPdfImages, processPdf, type PdfRequest } from '../src/pdf/operations.ts';

type InputFile = NonNullable<PdfRequest['files']>[number];

async function pdfWithPages(labels: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const label of labels) {
    const page = doc.addPage([300, 200]);
    page.drawText(label, { x: 24, y: 120, size: 18 });
  }
  return doc.save();
}

function encryptedPdfFixture(): Uint8Array {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1 1] >>',
    '<< /Filter /Standard /V 1 /R 2 /O <0000000000000000000000000000000000000000000000000000000000000000> /U <0000000000000000000000000000000000000000000000000000000000000000> /P -4 >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Encrypt 4 0 R /ID [<0123456789abcdef0123456789abcdef><0123456789abcdef0123456789abcdef>] >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(body);
}

function imageBytes(kind: 'jpg' | 'png'): Uint8Array {
  const encoded = kind === 'jpg'
    ? '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AD//Z'
    : 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
  return Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
}

function addJpegComment(source: Uint8Array, payloadLength = 2048): Uint8Array {
  const segmentLength = payloadLength + 2;
  const result = new Uint8Array(source.length + payloadLength + 4);
  result.set(source.subarray(0, 2), 0);
  result.set([0xff, 0xfe, segmentLength >> 8, segmentLength & 0xff], 2);
  result.fill(0x41, 6, 6 + payloadLength);
  result.set(source.subarray(2), 6 + payloadLength);
  return result;
}

async function pdfWithImage(kind: 'jpg' | 'png', overrideBytes?: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([240, 160]);
  page.drawText(`mixed scanned and vector content (${kind})`, { x: 12, y: 130, size: 12 });
  const bytes = overrideBytes ?? imageBytes(kind);
  const image = kind === 'jpg' ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
  page.drawImage(image, { x: 12, y: 12, width: 96, height: 96 });
  return doc.save();
}

function input(name: string, bytes: Uint8Array): InputFile {
  return { name, bytes };
}

async function run(operation: PdfRequest['operation'], files: InputFile[], overrides: Partial<PdfRequest> = {}) {
  return processPdf({ operation, files, ...overrides } as PdfRequest);
}

async function pageCount(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

async function extractedText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocument({ data: bytes.slice(), standardFontDataUrl: path.resolve('node_modules/pdfjs-dist/standard_fonts').replaceAll('\\', '/') + '/', isEvalSupported: false }).promise;
  const content: string[] = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const text = await page.getTextContent();
    content.push(...text.items.map((item: any) => 'str' in item ? item.str : ''));
  }
  await pdf.destroy();
  return content.join(' ');
}

test('merge combines files and retains selectable text', async () => {
  const result = await run('merge', [
    input('first.pdf', await pdfWithPages(['first page'])),
    input('second.pdf', await pdfWithPages(['second page'])),
  ]);
  assert.equal(result.files.length, 1);
  assert.equal(await pageCount(result.files[0].bytes), 2);
  const text = await extractedText(result.files[0].bytes);
  assert.match(text, /first page/);
  assert.match(text, /second page/);
});

test('split emits one PDF per one-based range group', async () => {
  const result = await run('split', [input('source.pdf', await pdfWithPages(['one', 'two', 'three']))], {
    ranges: '1,3',
  });
  assert.equal(result.files.length, 2);
  assert.deepEqual(await Promise.all(result.files.map((file) => pageCount(file.bytes))), [1, 1]);
  assert.match(await extractedText(result.files[0].bytes), /one/);
  assert.match(await extractedText(result.files[1].bytes), /three/);
});

test('extract and delete select the expected zero-based pages', async () => {
  const source = input('source.pdf', await pdfWithPages(['alpha', 'beta', 'gamma']));
  const extracted = await run('extract', [source], { pages: [0, 2] });
  assert.equal(await pageCount(extracted.files[0].bytes), 2);
  assert.match(await extractedText(extracted.files[0].bytes), /alpha/);
  assert.match(await extractedText(extracted.files[0].bytes), /gamma/);
  const deleted = await run('delete', [source], { pages: [1] });
  assert.equal(await pageCount(deleted.files[0].bytes), 2);
  const remainingText = await extractedText(deleted.files[0].bytes);
  assert.match(remainingText, /alpha/);
  assert.match(remainingText, /gamma/);
  assert.doesNotMatch(remainingText, /beta/);
});

test('reorder moves pages and preserves their text objects', async () => {
  const result = await run('reorder', [input('source.pdf', await pdfWithPages(['first', 'second', 'third']))], {
    pages: [2, 0, 1],
  });
  assert.equal(await pageCount(result.files[0].bytes), 3);
  const text = await extractedText(result.files[0].bytes);
  assert.ok(text.indexOf('third') < text.indexOf('first'));
  assert.ok(text.indexOf('first') < text.indexOf('second'));
});

test('rotate changes page orientation metadata without rasterizing text', async () => {
  const source = await pdfWithPages(['still selectable']);
  const original = await PDFDocument.load(source);
  const before = original.getPage(0).getRotation().angle;
  const result = await run('rotate', [input('source.pdf', source)], { rotations: { 0: 90 } });
  const output = await PDFDocument.load(result.files[0].bytes);
  assert.equal(output.getPage(0).getRotation().angle, (before + 90) % 360);
  assert.match(await extractedText(result.files[0].bytes), /still selectable/);
});

test('page numbering keeps existing text selectable and adds page labels', async () => {
  const result = await run('number', [input('source.pdf', await pdfWithPages(['body text']))]);
  const text = await extractedText(result.files[0].bytes);
  assert.match(text, /body text/);
  assert.match(text, /1/);
});

test('compression preset accepts a text-only PDF and preserves searchable content', async () => {
  const result = await run('compress', [input('source.pdf', await pdfWithPages(['searchable body']))], {
    preset: 'balanced',
  });
  assert.equal(result.files.length, 1);
  assert.match(await extractedText(result.files[0].bytes), /searchable body/);
});

test('compression safely falls back for a mixed image and text PDF when browser encoding is unavailable', async () => {
  const source = await pdfWithImage('jpg');
  const result = await run('compress', [input('mixed.pdf', source)], { preset: 'balanced' });
  assert.equal(result.files.length, 1);
  assert.match(result.warnings.join(' '), /preserved|decode/i);
  assert.match(await extractedText(result.files[0].bytes), /mixed scanned and vector content/);
});

test('the injectable compressor replaces a smaller eligible JPEG and retains selectable text', async () => {
  const sourceBytes = await pdfWithImage('jpg', addJpegComment(imageBytes('jpg')));
  const doc = await PDFDocument.load(sourceBytes);
  let encoderCalls = 0;
  const changed = await compressPdfImages(doc, 'balanced', async (_source, width, height) => {
    encoderCalls += 1;
    return { bytes: imageBytes('jpg'), width, height };
  });
  assert.equal(encoderCalls, 1);
  assert.equal(changed, 1);
  const outputBytes = await doc.save();
  assert.ok(outputBytes.length < sourceBytes.length);
  assert.equal(await pageCount(outputBytes), 1);
  assert.match(await extractedText(outputBytes), /mixed scanned and vector content/);
});

test('compression skips JPEG images with masks or decode parameters', async () => {
  for (const unsupportedKey of ['SMask', 'DecodeParms']) {
    const doc = await PDFDocument.load(await pdfWithImage('jpg'));
    const image = [...doc.context.enumerateIndirectObjects()].find(([, object]) =>
      object instanceof PDFRawStream && object.dict instanceof PDFDict && object.dict.get(PDFName.of('Subtype'))?.toString() === '/Image',
    )?.[1];
    assert.ok(image instanceof PDFRawStream);
    image.dict.set(PDFName.of(unsupportedKey), PDFNumber.of(0));
    let encoderCalls = 0;
    const warnings: string[] = [];
    const changed = await compressPdfImages(doc, 'balanced', async (_source, width, height) => {
      encoderCalls += 1;
      return { bytes: imageBytes('jpg'), width, height };
    }, warnings);
    assert.equal(encoderCalls, 0, `${unsupportedKey} image should not reach the encoder`);
    assert.equal(changed, 0);
    assert.match(warnings.join(' '), /unsupported|mask|decode map/i);
  }
});

test('JPG and PNG image inputs create a PDF with one page per image', async () => {
  const result = await run('images', [
    input('photo.jpg', imageBytes('jpg')),
    input('diagram.png', imageBytes('png')),
  ]);
  assert.equal(result.files.length, 1);
  assert.match(result.files[0].name, /\.pdf$/);
  assert.equal(await pageCount(result.files[0].bytes), 2);
});

test('image-to-PDF rejects unsupported image bytes', async () => {
  await assert.rejects(
    () => run('images', [input('unsupported.gif', new Uint8Array([1, 2, 3]))]),
    /JPG|PNG|image/i,
  );
});

test('malformed PDFs are rejected with a useful error', async () => {
  await assert.rejects(
    () => run('compress', [input('truncated.pdf', new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\n'))]),
    /PDF|document|parse|invalid|truncated/i,
  );
});

test('invalid ranges, empty deletes, duplicate reorder indexes, and out-of-range rotations are rejected', async () => {
  const source = input('source.pdf', await pdfWithPages(['one', 'two']));
  await assert.rejects(() => run('split', [source], { ranges: '0-2' }), /range|outside|one-based/i);
  await assert.rejects(() => run('delete', [source], { pages: [0, 1] }), /empty/i);
  await assert.rejects(() => run('reorder', [source], { pages: [0, 0] }), /once|selected more than once|page/i);
  await assert.rejects(() => run('rotate', [source], { rotations: { 2: 90 } }), /outside/i);
});

test('encrypted PDFs are rejected instead of being processed without a password', async () => {
  await assert.rejects(
    () => run('compress', [input('locked.pdf', encryptedPdfFixture())]),
    /encrypted|password/i,
  );
});
