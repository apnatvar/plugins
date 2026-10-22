import { processPdf, type PdfRequest, type PdfResult } from '../pdf/operations';

interface PdfWorkerRequest { id: number; request: PdfRequest }
type PdfWorkerResponse =
  | { id: number; type: 'progress'; value: number }
  | { id: number; type: 'result'; result: PdfResult }
  | { id: number; type: 'error'; error: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async ({ data }: MessageEvent<PdfWorkerRequest>) => {
  const id = data?.id;
  if (typeof id !== 'number' || !data.request) return;
  const send = (message: PdfWorkerResponse) => scope.postMessage(message);
  try {
    const result = await processPdf(data.request, (value) => send({ id, type: 'progress', value }));
    send({ id, type: 'result', result });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const memoryFailure = error instanceof RangeError || /out of memory|memory allocation|heap/i.test(rawMessage);
    const message = memoryFailure
      ? 'PDF processing ran out of memory. Try a smaller PDF, reduce image sizes, or process fewer pages at a time.'
      : rawMessage;
    send({ id, type: 'error', error: message });
  }
};
