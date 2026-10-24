import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, Download, FileImage, FilePlus2, FileText, Files,
  Image as ImageIcon, LoaderCircle, LockKeyhole, Maximize2,
  RotateCcw, RotateCw, Scissors, ShieldCheck, Sparkles, Trash2, Upload, X,
} from 'lucide-react';
import { Button } from './components/Button';
import { cancelPdf, runPdf } from './pdf/client';
import { imageFileType, readImageDimensions } from './pdf/validation';
import type { CompressionPreset, PdfOperation, PdfRequest, PdfResult } from './pdf/operations';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

type PdfPage = { number: number; width: number; height: number };
type LocalPdf = { id: string; name: string; bytes: Uint8Array; size: number; pages: PdfPage[]; doc: pdfjsLib.PDFDocumentProxy; title?: string; author?: string };
type LocalImage = { id: string; name: string; bytes: Uint8Array; size: number; previewUrl: string; type: 'image/jpeg' | 'image/png'; width: number; height: number };
type Tool = { id: PdfOperation; title: string; description: string; icon: typeof FileText; label: string };
const tools: Tool[] = [
  { id: 'compress', title: 'Compress', description: 'Reduce file size while keeping text sharp.', icon: Sparkles, label: 'Compress PDF' },
  { id: 'merge', title: 'Merge', description: 'Combine PDFs in the order you choose.', icon: Files, label: 'Merge PDFs' },
  { id: 'split', title: 'Split', description: 'Create separate PDFs from page ranges.', icon: Scissors, label: 'Split PDF' },
  { id: 'extract', title: 'Extract pages', description: 'Make a new PDF from selected pages.', icon: FilePlus2, label: 'Extract pages' },
  { id: 'delete', title: 'Delete pages', description: 'Remove selected pages from a PDF.', icon: Trash2, label: 'Delete pages' },
  { id: 'reorder', title: 'Reorder pages', description: 'Move pages into a new sequence.', icon: ArrowDown, label: 'Reorder pages' },
  { id: 'rotate', title: 'Rotate pages', description: 'Turn selected pages by 90 degrees.', icon: RotateCw, label: 'Rotate pages' },
  { id: 'images', title: 'Images to PDF', description: 'Turn JPG and PNG images into a PDF.', icon: FileImage, label: 'Images to PDF' },
  { id: 'number', title: 'Add page numbers', description: 'Add a simple number to each page.', icon: FileText, label: 'Add page numbers' },
];
const formatter = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
const formatSize = (size: number) => size < 1024 * 1024 ? `${formatter.format(size / 1024)} KB` : `${formatter.format(size / 1024 / 1024)} MB`;
const pdfPaths = {
  cMapUrl: new URL('/pdfjs/cmaps/', location.origin).href,
  standardFontDataUrl: new URL('/pdfjs/standard_fonts/', location.origin).href,
  wasmUrl: new URL('/pdfjs/wasm/', location.origin).href,
};

function toolById(id: PdfOperation) { return tools.find((tool) => tool.id === id)!; }

function Thumbnail({ file, pageNumber, selected, onClick, onOpen, disabled = false, badge, rotation = 0 }: { file: LocalPdf; pageNumber: number; selected: boolean; onClick: () => void; onOpen: () => void; disabled?: boolean; badge?: number; rotation?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | undefined;
    if (canvasRef.current) canvasRef.current.dataset.rendered = 'false';
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void (async () => {
        try {
          const page = await file.doc.getPage(pageNumber);
          if (cancelled || !canvasRef.current) return;
          const baseViewport = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: Math.min(0.34, 180 / baseViewport.width, 230 / baseViewport.height), rotation: page.rotate + rotation });
          const canvas = canvasRef.current;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          renderTask = page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport });
          await renderTask.promise;
          if (!cancelled) canvas.dataset.rendered = 'true';
        } catch { /* A thumbnail may be interrupted when the file is removed. */ }
      })();
    }, { rootMargin: '120px' });
    observer.observe(frame);
    return () => { cancelled = true; observer.disconnect(); renderTask?.cancel(); };
  }, [file, pageNumber, rotation]);
  return <div className={`page-card ${selected ? 'page-card-selected' : ''}`}>
    <button type="button" className="page-preview" onClick={onClick} aria-pressed={selected} aria-label={`Select page ${pageNumber}`} disabled={disabled}>
      <div ref={frameRef} className="page-canvas-wrap"><canvas ref={canvasRef} /><span className="page-placeholder"><FileText size={19} /></span></div>
      {selected && <span className="page-check"><Check size={12} /></span>}{badge !== undefined && <span className="page-check page-order-badge">{badge}</span>}
    </button>
    <div className="page-caption"><span>Page {pageNumber}</span><button type="button" onClick={onOpen} aria-label={`Preview page ${pageNumber}`}><Maximize2 size={13} /></button></div>
  </div>;
}

function PreviewDialog({ file, pageNumber, onClose, onNavigate }: { file: LocalPdf; pageNumber: number; onClose: () => void; onNavigate: (page: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let task: pdfjsLib.RenderTask | undefined;
    let cancelled = false;
    void (async () => {
      try {
        const page = await file.doc.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(1.2, (window.innerWidth - 160) / base.width, (window.innerHeight - 180) / base.height);
        const viewport = page.getViewport({ scale: Math.max(Number.EPSILON, scale) });
        const canvas = canvasRef.current;
        canvas.width = viewport.width; canvas.height = viewport.height;
        task = page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport });
        await task.promise;
      } catch { /* Preview closes cleanly if its document is removed. */ }
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [file, pageNumber]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); if (event.key === 'ArrowLeft') onNavigate(Math.max(1, pageNumber - 1)); if (event.key === 'ArrowRight') onNavigate(Math.min(file.pages.length, pageNumber + 1)); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNavigate, pageNumber, file.pages.length]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="preview-modal" role="dialog" aria-modal="true" aria-label={`Page ${pageNumber} preview`}>
      <header className="preview-header"><div><strong>{file.name}</strong><span>Page {pageNumber} of {file.pages.length}</span></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close preview"><X size={18} /></button></header>
      <div className="preview-content"><button className="preview-arrow" disabled={pageNumber <= 1} onClick={() => onNavigate(pageNumber - 1)} aria-label="Previous page"><ChevronLeft /></button><canvas ref={canvasRef} /><button className="preview-arrow" disabled={pageNumber >= file.pages.length} onClick={() => onNavigate(pageNumber + 1)} aria-label="Next page"><ChevronRight /></button></div>
    </section>
  </div>;
}

function Popup() {
  const openTool = () => { chrome.tabs.create({ url: `${chrome.runtime.getURL('workspace.html')}?tool=compress` }); };
  return <div className="popup-shell"><Brand /><div className="popup-heading"><div className="eyebrow">YOUR PDF TOOLKIT</div><h1>Private by design.</h1><p>Simple PDF tools that run on your device.</p></div>
    <div className="popup-tool-list">{tools.map((tool) => <button className="popup-tool" key={tool.id} onClick={() => { chrome.tabs.create({ url: `${chrome.runtime.getURL(`workspace.html?tool=${tool.id}`)}` }); }}><span className="tool-icon"><tool.icon size={17} /></span><span><b>{tool.title}</b><small>{tool.description}</small></span><ChevronRight size={16} /></button>)}</div>
    <Button className="popup-open" size="wide" onClick={openTool}>Open PDF workspace <ArrowRight size={16} /></Button>
    <div className="popup-trust"><LockKeyhole size={14} /> Your files stay on this device.</div><Footer compact />
  </div>;
}

function Brand() { return <a className="brand" href="https://brownsmithdynamics.com" target="_blank" rel="noreferrer"><span className="brand-mark"><FileText size={20} strokeWidth={2.1} /></span><span><strong>PPDF</strong><small>Privacy PDF by [BD]</small></span></a>; }
function Footer({ compact = false }: { compact?: boolean }) { return <footer className={`app-footer ${compact ? 'app-footer-compact' : ''}`}><span>Made for your documents.</span><span><a href="https://plugins.brownsmithdynamics.com" target="_blank" rel="noreferrer">More tools</a><i>·</i><a href="https://brownsmithdynamics.com" target="_blank" rel="noreferrer">Brownsmith Dynamics</a></span></footer>; }

export default function App() {
  const [tool, setTool] = useState<PdfOperation>(() => {
    const fromUrl = new URLSearchParams(location.search).get('tool');
    return tools.some((item) => item.id === fromUrl) ? fromUrl as PdfOperation : 'compress';
  });
  const [files, setFiles] = useState<LocalPdf[]>([]);
  const [images, setImages] = useState<LocalImage[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [rangeText, setRangeText] = useState('1-3');
  const [preset, setPreset] = useState<CompressionPreset>('balanced');
  const [rotations, setRotations] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [result, setResult] = useState<PdfResult | null>(null);
  const [resultOriginalSize, setResultOriginalSize] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<{ fileId: string; page: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<LocalPdf[]>([]); filesRef.current = files;
  const imagesRef = useRef<LocalImage[]>([]); imagesRef.current = images;
  const activeTool = toolById(tool);
  const needsSingle = tool !== 'merge' && tool !== 'images';
  const itemCount = tool === 'images' ? images.length : files.length;
  const locked = busy || loading;
  const pageFile = files[0];
  const totalPages = pageFile?.pages.length ?? 0;
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  useEffect(() => () => { cancelPdf(); filesRef.current.forEach((file) => file.doc.destroy()); imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl)); }, []);
  useEffect(() => { setError(''); setNotice(''); setResult(null); setSelected([]); setPageOrder([]); }, [tool]);
  useEffect(() => { if (pageFile) setRangeText(`1-${Math.min(3, pageFile.pages.length)}`); }, [pageFile?.id, pageFile?.pages.length]);

  const addFiles = useCallback(async (list: FileList | File[]) => {
    if (locked) return;
    setLoading(true);
    setError(''); setNotice(''); setResult(null);
    try {
    if (tool === 'images') {
      const additions: LocalImage[] = [];
      for (const file of Array.from(list)) {
        try {
          if (file.size > 100 * 1024 * 1024) throw new Error(`${file.name} exceeds the 100 MB image limit.`);
          const bytes = new Uint8Array(await file.arrayBuffer());
          const type = imageFileType({name:file.name,bytes});
          readImageDimensions(bytes,type);
          const jpeg = type === 'jpg';
          const blob = new Blob([bytes.slice().buffer], { type: jpeg ? 'image/jpeg' : 'image/png' });
          const bitmap = await createImageBitmap(blob);
          if (bitmap.width * bitmap.height > 40_000_000) { bitmap.close(); throw new Error(`${file.name} exceeds the 40 megapixel limit.`); }
          const image: LocalImage = { id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`, name: file.name, bytes, size: bytes.length, previewUrl: URL.createObjectURL(blob), type: jpeg ? 'image/jpeg' : 'image/png', width: bitmap.width, height: bitmap.height };
          bitmap.close(); additions.push(image);
        } catch (caught) { setError(caught instanceof Error ? caught.message : `Could not open ${file.name}.`); }
      }
      if (additions.length) setImages((current) => [...current, ...additions]);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    const additions: LocalPdf[] = [];
    for (const file of Array.from(list)) {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') { setError(`${file.name} is not a PDF file.`); continue; }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (new TextDecoder().decode(bytes.subarray(0, 8)).indexOf('%PDF-') < 0) throw new Error('This file does not contain a PDF header.');
        const loadingTask = pdfjsLib.getDocument({ data: bytes.slice(), ...pdfPaths, cMapPacked: true, isEvalSupported: false });
        let rejectPassword!: (reason: Error) => void;
        const passwordError = new Promise<never>((_, reject) => { rejectPassword = reject; });
        loadingTask.onPassword = () => { rejectPassword(new Error(`“${file.name}” is encrypted or password-protected.`)); void loadingTask.destroy(); };
        const doc = await Promise.race([loadingTask.promise, passwordError]);
        const pages: PdfPage[] = Array.from({ length: doc.numPages }, (_, i) => ({ number: i + 1, width: 0, height: 0 }));
        const metadata = await doc.getMetadata().catch(() => null);
        const info = metadata && 'info' in metadata ? metadata.info as Record<string, unknown> : {};
        const safeString = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 160) : undefined;
        additions.push({ id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`, name: file.name, bytes, size: bytes.length, pages, doc, title: safeString(info.Title), author: safeString(info.Author) });
      } catch (caught) { setError(caught instanceof Error ? caught.message : `Could not open ${file.name}.`); }
    }
    if (additions.length) setFiles((current) => {
      if (tool !== 'merge') { current.forEach((file) => void file.doc.destroy()); return additions.slice(-1); }
      return [...current, ...additions];
    });
    if (tool !== 'merge') { setSelected([]); setPageOrder([]); setRotations({}); setPreview(null); }
    if (inputRef.current) inputRef.current.value = '';
    } finally { setLoading(false); }
  }, [tool, locked]);

  const removeFile = (id: string) => {
    setFiles((current) => { const removed = current.find((file) => file.id === id); if (removed) void removed.doc.destroy(); return current.filter((file) => file.id !== id); });
    setSelected([]); setPageOrder([]); setRotations({}); setPreview(null); setResult(null);
  };
  const removeImage = (id: string) => { setImages((current) => { const image = current.find((item) => item.id === id); if (image) URL.revokeObjectURL(image.previewUrl); return current.filter((item) => item.id !== id); }); setResult(null); };
  const reorderFile = (index: number, direction: -1 | 1) => setFiles((current) => {
    const next = [...current]; const target = index + direction; if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]]; return next;
  });
  const handleDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); if (!locked && event.dataTransfer.files.length) void addFiles(event.dataTransfer.files); };
  const togglePage = (page: number) => setSelected((current) => current.includes(page) ? current.filter((item) => item !== page) : [...current, page].sort((a, b) => a - b));

  const startProcess = async () => {
    setError(''); setNotice(''); setResult(null);
    if (tool === 'images' && !images.length) { setError('Choose at least one JPG or PNG image.'); return; }
    if (tool !== 'images' && !files.length) { setError('Choose a PDF file to get started.'); return; }
    if (needsSingle && files.length !== 1) { setError('Choose one PDF for this tool, or remove the extra files.'); return; }
    if (tool === 'merge' && files.length < 2) { setError('Add at least two PDFs to merge.'); return; }
    if (['extract', 'delete'].includes(tool) && selected.length === 0) { setError('Select at least one page in the preview.'); return; }
    const request: PdfRequest = { operation: tool, files: (tool === 'images' ? images : files).map(({ name, bytes }) => ({ name, bytes })), preset };
    if (tool === 'extract' || tool === 'delete') request.pages = selected;
    if (tool === 'reorder') request.pages = pageOrder.length === totalPages ? pageOrder : Array.from({ length: totalPages }, (_, i) => i);
    if (tool === 'split') request.ranges = rangeText;
    if (tool === 'rotate') request.rotations = rotations;
    setBusy(true); setProgress(0);
    try {
      const output = await runPdf(request, setProgress);
      setResult(output); setResultOriginalSize((tool === 'images' ? images : files).reduce((sum, file) => sum + file.size, 0));
      if (!output.files.length) setNotice('No supported embedded JPG images were found.');
      else setNotice(output.warnings.length ? 'Finished with a few notes below.' : 'Your PDF is ready.');
    } catch (caught) { const message = caught instanceof Error ? caught.message : String(caught); if (!/cancelled/i.test(message)) setError(message); }
    finally { setBusy(false); }
  };

  const download = (name: string, bytes: Uint8Array) => {
    const blob = new Blob([bytes.slice().buffer], { type: name.toLowerCase().endsWith('.jpg') ? 'image/jpeg' : 'application/pdf' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  const compressionShrunk = result?.files.length === 1 && resultOriginalSize > result.files[0].bytes.length;
  const activePreviewFile = preview ? files.find((file) => file.id === preview.fileId) : undefined;
  const pageSequence = pageOrder.length === totalPages ? pageOrder : Array.from({ length: totalPages }, (_, i) => i);
  const movePage = (from: number, to: number) => setPageOrder((current) => {
    const order = current.length === totalPages ? [...current] : Array.from({ length: totalPages }, (_, i) => i);
    if (from < 0 || from >= order.length || to < 0 || to >= order.length) return order;
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    return order;
  });

  if (location.pathname.endsWith('/popup.html')) return <Popup />;
  return <div className="app-shell">
    <header className="topbar"><Brand /><div className="privacy-pill"><span className="privacy-dot" /> Everything stays on your device</div><a className="topbar-help" href="https://plugins.brownsmithdynamics.com" target="_blank" rel="noreferrer"><CircleHelp size={16} /> Help</a></header>
    <main className="workspace">
      <section className="workspace-heading"><div><div className="eyebrow">PDF WORKSPACE</div><h1>Make your PDFs work for you.</h1><p>Choose a tool, add your file, and your document never leaves this device.</p></div><div className="heading-stamp"><ShieldCheck size={18} /><span>Local processing<br /><b>Private by default</b></span></div></section>
      <div className="workspace-grid">
        <aside className="tool-rail"><div className="rail-label">TOOLS</div>{tools.map((item) => <button key={item.id} disabled={locked} className={`tool-item ${tool === item.id ? 'tool-item-active' : ''}`} onClick={() => { setTool(item.id); const url = new URL(location.href); url.searchParams.set('tool', item.id); history.replaceState({}, '', url); }} aria-current={tool === item.id ? 'page' : undefined}><span className="rail-icon"><item.icon size={17} /></span><span>{item.title}</span></button>)}<div className="rail-note"><LockKeyhole size={14} /><span>Files are processed locally in your browser.</span></div></aside>
        <section className="work-card">
          <div className="card-heading"><div className="active-tool-icon"><activeTool.icon size={19} /></div><div><h2>{activeTool.label}</h2><p>{activeTool.description}</p></div><span className="local-tag"><LockKeyhole size={12} /> On device</span></div>
          <div className={`drop-zone ${dragging ? 'drop-zone-active' : ''} ${itemCount ? 'drop-zone-filled' : ''}`} onDragOver={(event) => { if (!locked) { event.preventDefault(); setDragging(true); } }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
            <input ref={inputRef} className="sr-only" type="file" accept={tool === 'images' ? 'image/jpeg,image/png,.jpg,.jpeg,.png' : 'application/pdf,.pdf'} multiple={tool === 'merge' || tool === 'images'} disabled={locked} onChange={(event: ChangeEvent<HTMLInputElement>) => event.target.files && void addFiles(event.target.files)} />
            <div className="drop-symbol"><Upload size={19} /></div><div className="drop-copy"><strong>{itemCount ? (tool === 'merge' || tool === 'images' ? 'Add another file' : 'Add a different PDF') : tool === 'images' ? 'Drop your images here' : 'Drop your PDF here'}</strong><span>{tool === 'images' ? 'JPG and PNG · processed privately on this device' : 'PDF files only · processed privately on this device'}</span></div><Button disabled={locked} variant="secondary" size="sm" onClick={() => inputRef.current?.click()}><Upload size={14} /> Browse files</Button>
          </div>

          {tool !== 'images' && files.length > 0 && <div className="file-list" aria-label="Selected files">{files.map((file, index) => <div className="file-row" key={file.id}><div className="file-type-icon"><FileText size={17} /></div><div className="file-info"><strong title={file.name}>{file.name}</strong><span>{file.pages.length} {file.pages.length === 1 ? 'page' : 'pages'} <i>·</i> {formatSize(file.size)}{file.title ? ` · ${file.title}` : ''}{file.author ? ` · ${file.author}` : ''}</span></div>{tool === 'merge' && <div className="file-order"><Button variant="ghost" size="icon" disabled={busy || index === 0} onClick={() => reorderFile(index, -1)} aria-label={`Move ${file.name} up`}><ArrowUp size={15} /></Button><Button variant="ghost" size="icon" disabled={busy || index === files.length - 1} onClick={() => reorderFile(index, 1)} aria-label={`Move ${file.name} down`}><ArrowDown size={15} /></Button></div>}<Button disabled={busy} variant="ghost" size="icon" onClick={() => removeFile(file.id)} aria-label={`Remove ${file.name}`}><X size={16} /></Button></div>)}</div>}
          {tool === 'images' && images.length > 0 && <div className="file-list" aria-label="Selected images">{images.map((image) => <div className="file-row" key={image.id}><img className="image-thumb" src={image.previewUrl} alt="" /><div className="file-info"><strong title={image.name}>{image.name}</strong><span>{image.width} × {image.height} <i>·</i> {formatSize(image.size)} <i>·</i> {image.type === 'image/jpeg' ? 'JPG' : 'PNG'}</span></div><Button disabled={busy} variant="ghost" size="icon" onClick={() => removeImage(image.id)} aria-label={`Remove ${image.name}`}><X size={16} /></Button></div>)}</div>}

          {tool === 'compress' && <div className="option-block"><div className="option-title"><div><strong>Compression level</strong><span>Text and vector artwork stay crisp.</span></div><a href="#compression-note">How it works</a></div><div className="preset-options">{([{ id: 'high', title: 'High quality', detail: 'Gentle reduction' }, { id: 'balanced', title: 'Balanced', detail: 'Recommended' }, { id: 'smallest', title: 'Smallest size', detail: 'Aggressive image reduction' }] as { id: CompressionPreset; title: string; detail: string }[]).map((item) => <button key={item.id} disabled={locked} onClick={() => setPreset(item.id)} className={`preset-card ${preset === item.id ? 'preset-card-selected' : ''}`} aria-pressed={preset === item.id}><span className="preset-radio">{preset === item.id && <i />}</span><strong>{item.title}</strong><small>{item.detail}</small></button>)}</div></div>}

          {tool === 'split' && files.length > 0 && <div className="option-block"><label className="field-label" htmlFor="page-ranges">Page ranges <span>Use commas between groups</span></label><input id="page-ranges" disabled={locked} className="text-field" value={rangeText} onChange={(event) => setRangeText(event.target.value)} placeholder="1-3, 5, 7-9" /><p className="field-hint">One-based page numbers, for example 1-3,5.</p></div>}
          {tool === 'rotate' && files.length > 0 && <div className="rotate-tools"><span>Select pages below, then turn them:</span><Button disabled={locked || !selected.length} variant="secondary" size="sm" onClick={() => setRotations((current) => ({ ...current, ...Object.fromEntries(selected.map((index) => [index, (current[index] ?? 0) - 90])) }))}><RotateCcw size={14} /> Left 90°</Button><Button disabled={locked || !selected.length} variant="secondary" size="sm" onClick={() => setRotations((current) => ({ ...current, ...Object.fromEntries(selected.map((index) => [index, (current[index] ?? 0) + 90])) }))}><RotateCw size={14} /> Right 90°</Button><span className="selected-count">{selected.length} selected</span></div>}
          {['extract', 'delete', 'rotate', 'reorder'].includes(tool) && files.length > 0 && <div className="page-tools"><div className="page-tools-label"><div><strong>{tool === 'reorder' ? 'Page order' : 'Choose pages'}</strong><span>{tool === 'delete' ? 'Selected pages will be removed.' : tool === 'extract' ? 'Selected pages will be saved as a new PDF.' : tool === 'rotate' ? 'Click to select the pages to turn.' : 'Drag pages or use the arrows to set their final sequence.'}</span></div><span>{tool === 'reorder' ? `${pageOrder.length ? pageOrder.length : totalPages} pages` : `${selected.length} selected`}</span></div>{tool === 'extract' || tool === 'delete' ? <div className="select-actions"><button disabled={busy} onClick={() => setSelected(Array.from({ length: totalPages }, (_, i) => i))}>Select all</button><button disabled={busy} onClick={() => setSelected([])}>Clear selection</button></div> : null}
            {tool === 'reorder' && <div className="reorder-grid">{pageSequence.map((sourceIndex, position) => { const page = pageFile.pages[sourceIndex]; return <div className="reorder-tile" key={page.number} draggable={!locked} onDragStart={(event) => { event.dataTransfer.setData('text/plain', String(position)); event.dataTransfer.effectAllowed = 'move'; }} onDragOver={(event) => { if (!locked) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); const from = Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) movePage(from, position); }}><Thumbnail file={pageFile} pageNumber={page.number} selected={false} disabled={locked} badge={position + 1} onClick={() => {}} onOpen={() => setPreview({ fileId: pageFile.id, page: page.number })} /><div className="reorder-controls"><button aria-label={`Move page ${page.number} earlier`} disabled={locked || position === 0} onClick={() => movePage(position, position - 1)}><ArrowLeft size={13} /></button><button aria-label={`Move page ${page.number} later`} disabled={locked || position === totalPages - 1} onClick={() => movePage(position, position + 1)}><ArrowRight size={13} /></button></div></div>; })}</div>}
            {tool !== 'reorder' && <div className="page-grid">{pageFile.pages.map((page, index) => <Thumbnail key={page.number} file={pageFile} pageNumber={page.number} selected={selectedSet.has(index)} rotation={rotations[index] ?? 0} disabled={locked} onClick={() => !locked && togglePage(index)} onOpen={() => setPreview({ fileId: pageFile.id, page: page.number })} />)}</div>}
          </div>}

          {pageFile && tool !== 'images' && !['extract', 'delete', 'rotate', 'reorder'].includes(tool) && <details className="document-preview"><summary><span><FileText size={14} /> Document preview</span><ChevronDown size={14} /></summary><div className="document-meta"><span>{pageFile.pages.length} {pageFile.pages.length === 1 ? 'page' : 'pages'} · {formatSize(pageFile.size)}</span>{pageFile.title && <span>Title: {pageFile.title}</span>}{pageFile.author && <span>Author: {pageFile.author}</span>}</div><div className="page-grid">{pageFile.pages.map((page) => <Thumbnail key={page.number} file={pageFile} pageNumber={page.number} selected={false} disabled onClick={() => {}} onOpen={() => setPreview({ fileId: pageFile.id, page: page.number })} />)}</div></details>}

          {tool === 'images' && <div className="info-note"><ImageIcon size={16} /><span>Each image becomes a page in the PDF. JPG and PNG files up to 40 megapixels are supported.</span></div>}
          {tool === 'number' && <div className="info-note"><FileText size={16} /><span>Page numbers are added in a small, neutral style at the bottom right of each page.</span></div>}

          {error && <div className="alert alert-error" role="alert"><CircleHelp size={16} /><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={15} /></button></div>}
          {(busy || loading) && <div className="progress-wrap" role="status"><div className="progress-copy"><span><LoaderCircle size={15} className="spin" /> {loading ? 'Opening files locally…' : 'Processing locally…'}</span><strong>{busy ? `${progress}%` : ''}</strong></div>{busy && <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>}{busy && <button className="cancel-job" onClick={() => cancelPdf()}>Cancel</button>}</div>}
          {notice && !busy && result && <div className="alert alert-success" role="status"><Check size={16} /><span>{notice}</span></div>}
          {result?.warnings.map((warning, index) => <div className="warning-line" key={`${warning}-${index}`}><CircleHelp size={14} />{warning}</div>)}
          {result?.files.length ? <div className="result-list"><div className="result-heading"><span className="result-check"><Check size={15} /></span><div><strong>Ready to save</strong><span>{result.files.length} {result.files.length === 1 ? 'file' : 'files'} created on your device</span></div></div>{result.files.map((output) => <div className="result-row" key={output.name}><FileText size={17} /><div className="result-file"><strong>{output.name}</strong><span>{formatSize(output.bytes.length)}{tool === 'compress' ? compressionShrunk ? ` · ${formatter.format(Math.min(99.9, (1 - output.bytes.length / Math.max(1, resultOriginalSize)) * 100))}% smaller` : output.bytes.length > resultOriginalSize ? ` · ${Math.round((output.bytes.length / Math.max(1, resultOriginalSize) - 1) * 100)}% larger — original recommended` : ' · no size reduction' : ''}</span></div>{tool === 'compress' && !compressionShrunk ? <Button variant="secondary" size="sm" onClick={() => download(files[0].name, files[0].bytes)}>Download original</Button> : <Button variant="secondary" size="sm" onClick={() => download(output.name, output.bytes)}><Download size={14} /> Save</Button>}</div>)}</div> : null}

          <div className="action-row"><Button size="wide" className="run-button" disabled={locked || !itemCount || (tool === 'merge' && files.length < 2)} onClick={() => void startProcess()}>{busy ? <><LoaderCircle size={16} className="spin" /> Working…</> : loading ? 'Opening files…' : <>{activeTool.label} <ArrowRight size={16} /></>}</Button>{itemCount > 0 && <Button disabled={locked} variant="ghost" onClick={() => { cancelPdf(); files.forEach((file) => void file.doc.destroy()); images.forEach((image) => URL.revokeObjectURL(image.previewUrl)); setFiles([]); setImages([]); setSelected([]); setPageOrder([]); setResult(null); setError(''); setNotice(''); setRotations({}); }}>Clear all</Button>}</div>
          {tool === 'compress' && <p id="compression-note" className="compression-note"><ShieldCheck size={14} /> Compression targets eligible JPEG photos only. Smallest size aggressively reduces image detail, including text inside scans. High quality keeps more detail. Selectable text, vectors, and unsupported images are preserved.</p>}
          {['delete', 'rotate', 'reorder', 'number', 'extract'].includes(tool) && <p className="compression-note"><CircleHelp size={14} /> Editing a PDF can affect digital signatures, interactive forms, bookmarks, or document metadata.</p>}
          {tool === 'split' && <p className="compression-note"><Files size={14} /> Each comma-separated group creates a separate PDF, in the order entered.</p>}
        </section>
      </div>
      <section className="privacy-strip"><span className="privacy-icon"><LockKeyhole size={16} /></span><div><strong>Your documents stay yours.</strong><p>PDFs are opened and processed locally. Nothing is uploaded to a server.</p></div><span className="privacy-check"><Check size={14} /> Private workspace</span></section>
      <Footer />
    </main>
    {activePreviewFile && preview && <PreviewDialog file={activePreviewFile} pageNumber={preview.page} onClose={() => setPreview(null)} onNavigate={(page) => setPreview((current) => current ? { ...current, page } : current)} />}
  </div>;
}
