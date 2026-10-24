import type { Schema } from './types.js';

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
export function isSafeKey(key: string): boolean { return !FORBIDDEN_KEYS.has(key); }
export function validateSchema(schema: Schema): void {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) throw new TypeError('Schema must be an object');
  const fields = Object.keys(schema);
  if (fields.length > 1_000) throw new TypeError('Schema has too many fields');
  for (const field of fields) {
    if (field.length > 512) throw new TypeError('Schema field name is too long');
    if (!isSafeKey(field)) throw new TypeError('Schema contains a forbidden field name');
    const def = schema[field];
    if (!def || typeof def !== 'object' || !['string', 'number', 'boolean', 'date'].includes(def.type)) throw new TypeError(`Invalid schema definition for ${field}`);
    if (def.required !== undefined && typeof def.required !== 'boolean') throw new TypeError(`Invalid required setting for ${field}`);
    if (def.trim !== undefined && typeof def.trim !== 'boolean') throw new TypeError(`Invalid trim setting for ${field}`);
    if (def.nullable !== undefined && typeof def.nullable !== 'boolean') throw new TypeError(`Invalid nullable setting for ${field}`);
    if (def.emptyValue !== undefined && !['omit', 'null', 'empty'].includes(def.emptyValue)) throw new TypeError(`Invalid emptyValue setting for ${field}`);
    if (def.format !== undefined && !['iso', 'date-only'].includes(def.format)) throw new TypeError(`Invalid date format for ${field}`);
    if (def.aliases !== undefined && (!Array.isArray(def.aliases) || def.aliases.some(x => typeof x !== 'string' || x.length > 512) || def.aliases.length > 100)) throw new TypeError(`Invalid aliases for ${field}`);
    if (def.transform !== undefined && typeof def.transform !== 'function') throw new TypeError(`Invalid transform for ${field}`);
  }
}
