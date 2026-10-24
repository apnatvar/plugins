import { createReadStream } from 'node:fs';
import { createMapper } from './index.js';
import type { MapperOptions, MappingResult, RowResult, Schema } from './types.js';

export async function mapFile(path: string, schema: Schema, options: MapperOptions = {}): Promise<MappingResult> {
  const mapper = createMapper(schema, options);
  const maxBytes = options.parser?.maxInputBytes ?? 50 * 1024 * 1024;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new TypeError('maxInputBytes must be a positive safe integer');
  const chunks: Uint8Array[] = []; let size = 0;
  const stream = createReadStream(path, { highWaterMark: 64 * 1024 });
  try {
    for await (const chunk of stream) {
      size += chunk.byteLength;
      if (size > maxBytes) { stream.destroy(); return { rows: [], errors: [{ code: 'MAX_INPUT_BYTES', message: 'CSV input exceeds the configured size limit' }], mappings: [], headers: [] }; }
      chunks.push(chunk);
    }
  } finally { stream.destroy(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { return { rows: [], errors: [{ code: 'INVALID_UTF8', message: 'CSV file contains invalid UTF-8 data' }], mappings: [], headers: [] }; }
  return mapper.map(text);
}

export async function* mapFileStream(path: string, schema: Schema, options: MapperOptions = {}): AsyncGenerator<RowResult> {
  const mapper = createMapper(schema, options);
  const stream = createReadStream(path, { highWaterMark: 64 * 1024 });
  try { yield* mapper.mapStream(stream); }
  finally { stream.destroy(); }
}
