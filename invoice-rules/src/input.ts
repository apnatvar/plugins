import type { Limits } from './types.js';

export class InputError extends Error { constructor(readonly code: string, message: string) { super(message); } }
/** Inspect descriptors before reading values. Copies only bounded JSON data; never invokes toJSON. */
export function snapshot(input: unknown, limits: Limits): unknown {
  let nodes = 0;
  const ancestors = new Set<object>();
  function copy(value: unknown, depth: number): unknown {
    if (++nodes > limits.maxNodes || depth > limits.maxDepth) throw new InputError('INPUT_LIMIT', 'Input exceeds node or depth limit.');
    if (typeof value === 'string') {
      if (value.length > limits.maxStringLength) throw new InputError('INPUT_LIMIT', 'Input string exceeds length limit.');
      return value;
    }
    if (typeof value === 'number' && !Number.isFinite(value)) throw new InputError('INVALID_NUMBER', 'Non-finite numbers are not accepted.');
    if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value !== 'object') throw new InputError('UNSAFE_INPUT', 'Only JSON-compatible values are accepted.');
    if (ancestors.has(value)) throw new InputError('UNSAFE_INPUT', 'Cyclic input is not accepted.');
    const array = Array.isArray(value);
    const proto: unknown = Object.getPrototypeOf(value);
    if (proto !== (array ? Array.prototype : Object.prototype) && !(proto === null && !array)) throw new InputError('UNSAFE_INPUT', 'Only plain objects and arrays are accepted.');
    const keys = Reflect.ownKeys(value);
    if (keys.length > limits.maxNodes - nodes + 1) throw new InputError('INPUT_LIMIT', 'Object exceeds node limit.');
    const result: unknown[] | Record<string, unknown> = array ? [] : Object.create(null) as Record<string, unknown>;
    ancestors.add(value);
    let count = 0;
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || key.length > limits.maxStringLength || ['__proto__', 'constructor', 'prototype'].includes(key)) throw new InputError('UNSAFE_INPUT', 'Unsafe object key.');
      if (array && !/^(0|[1-9]\d*)$/.test(key)) throw new InputError('UNSAFE_INPUT', 'Arrays may contain indexed elements only.');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw new InputError('UNSAFE_INPUT', 'Accessors and hidden properties are not accepted.');
      Object.defineProperty(result, key, { value: copy(descriptor.value, depth + 1), enumerable: true, writable: false, configurable: false });
      count++;
    }
    if (array && count !== (value as unknown[]).length) throw new InputError('UNSAFE_INPUT', 'Sparse arrays are not accepted.');
    ancestors.delete(value);
    return Object.freeze(result);
  }
  return copy(input, 0);
}
