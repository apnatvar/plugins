import type { PdfRequest, PdfResult } from './operations';

type WorkerMessage =
  | { id: number; type: 'progress'; value: number }
  | { id: number; type: 'result'; result: PdfResult }
  | { id: number; type: 'error'; error: string };

let activeWorker: Worker | undefined;
let activeReject: ((error: Error) => void) | undefined;
let nextId = 1;

/** Runs one PDF job in a module worker. A second invocation cancels the first. */
export function runPdf(request: PdfRequest, onProgress?: (value: number) => void): Promise<PdfResult> {
  cancelPdf();
  const id = nextId++;
  return new Promise<PdfResult>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('../workers/pdf.worker.ts', import.meta.url), { type: 'module' });
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    activeWorker = worker;
    activeReject = reject;
    const clear = () => {
      worker.terminate();
      if (activeWorker === worker) {
        activeWorker = undefined;
        activeReject = undefined;
      }
    };
    worker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
      if (!data || data.id !== id) return;
      if (data.type === 'progress') {
        try {
          onProgress?.(data.value);
        } catch (error) {
          clear();
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      } else if (data.type === 'result') {
        clear();
        resolve(data.result);
      } else {
        clear();
        reject(new Error(data.error));
      }
    };
    worker.onerror = (event) => {
      clear();
      reject(new Error(event.message || 'PDF worker failed.'));
    };
    worker.onmessageerror = () => {
      clear();
      reject(new Error('PDF worker returned an unreadable response.'));
    };
    try {
      worker.postMessage({ id, request });
    } catch (error) {
      clear();
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/** Cancels the active job and rejects its promise with a cancellation error. */
export function cancelPdf(): void {
  if (!activeWorker) return;
  const worker = activeWorker;
  const reject = activeReject;
  activeWorker = undefined;
  activeReject = undefined;
  worker.terminate();
  reject?.(new Error('PDF operation cancelled.'));
}
