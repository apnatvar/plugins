import { SCALE, parseDecimal, quantize, moneyProduct, moneyPercentage, divideRounded } from './decimal.js';
import { InputError, snapshot } from './input.js';
import type { Decimal, Invoice, Limits, ValidationIssue, ValidationOptions, ValidationResult, Severity } from './types.js';
export type * from './types.js';

const DEFAULT_LIMITS: Limits = { maxItems: 1000, maxTaxesPerItem: 10, maxDepth: 12, maxNodes: 100000, maxStringLength: 4096, maxJsonLength: 2000000, maxIssues: 1000 };
const HARD_LIMITS: Limits = { maxItems: 10000, maxTaxesPerItem: 50, maxDepth: 32, maxNodes: 500000, maxStringLength: 65536, maxJsonLength: 10000000, maxIssues: 10000 };
const severities: readonly string[] = ['error', 'warning', 'info', 'off'];
const protectedCodes = new Set(['INPUT_LIMIT', 'UNSAFE_INPUT', 'SCHEMA_REQUIRED', 'SCHEMA_TYPE', 'INVALID_NUMBER', 'INVALID_JSON', 'INVALID_OPTIONS', 'RULE_FAILURE']);
type Obj = Record<string, unknown>;
const object = (value: unknown): value is Obj => value !== null && typeof value === 'object' && !Array.isArray(value);
function dateValid(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const y = Number(value.slice(0, 4)), m = Number(value.slice(5, 7)), d = Number(value.slice(8));
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= ([31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] ?? 0);
}
function regexTest(pattern: RegExp, value: string): boolean { return new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, '')).test(value); }
function configuration(options: ValidationOptions): Limits {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) throw new Error('Options must be an object.');
  if (options.precision !== undefined && (typeof options.precision !== 'number' || !Number.isInteger(options.precision) || options.precision < 0 || options.precision > 6)) throw new Error('Precision must be an integer from 0 to 6.');
  if (options.rounding !== undefined && !['half-up', 'half-even', 'toward-zero'].includes(options.rounding)) throw new Error('Invalid rounding policy.');
  if (options.taxRounding !== undefined && !['line', 'invoice'].includes(options.taxRounding)) throw new Error('Invalid tax rounding policy.');
  for (const key of ['allowNegative', 'allowZeroQuantity'] as const) if (options[key] !== undefined && typeof options[key] !== 'boolean') throw new Error('Invalid boolean option.');
  if (options.limits !== undefined && !object(options.limits)) throw new Error('Limits must be an object.');
  const limits = { ...DEFAULT_LIMITS };
  for (const key of Object.keys(options.limits ?? {})) {
    if (!Object.hasOwn(DEFAULT_LIMITS, key)) throw new Error('Unknown limit.');
    const name = key as keyof Limits; const value = options.limits?.[name];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > HARD_LIMITS[name]) throw new Error('Limit outside supported bounds.');
    limits[name] = value;
  }
  if (options.identifierPattern !== undefined && !(options.identifierPattern instanceof RegExp)) throw new Error('Invalid identifier pattern.');
  if (options.identifiers !== undefined) {
    if (!object(options.identifiers)) throw new Error('Invalid identifier options.');
    for (const role of ['supplier', 'customer'] as const) {
      const rule = options.identifiers[role];
      if (rule !== undefined && (!object(rule) || !(rule.pattern instanceof RegExp) || (rule.required !== undefined && typeof rule.required !== 'boolean'))) throw new Error('Invalid party identifier rule.');
    }
  }
  if (options.severities !== undefined && (!object(options.severities) || Object.entries(options.severities).some(([key, value]) => !/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(key) || typeof value !== 'string' || !severities.includes(value)))) throw new Error('Invalid severity map.');
  if (options.rules !== undefined && (!Array.isArray(options.rules) || options.rules.length > 100 || options.rules.some(r => !object(r) || typeof r.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(r.id) || typeof r.validate !== 'function'))) throw new Error('Invalid custom rules.');
  return limits;
}
function failure(code: string, message: string): ValidationResult { return { valid: false, issues: [{ code, path: '', severity: 'error', message }], truncated: false }; }

/** Validate an immutable bounded snapshot. No network calls or input mutation. */
export function validateInvoice(input: unknown, options: ValidationOptions = {}): ValidationResult {
  let limits: Limits;
  try { limits = configuration(options); } catch { return failure('INVALID_OPTIONS', 'Invalid validator configuration. See the documented option bounds.'); }
  const precision = options.precision ?? 2, rounding = options.rounding ?? 'half-up';
  const issues: ValidationIssue[] = []; let truncated = false, hasError = false;
  const add = (code: string, path: string, message: string, severity: Severity = 'error'): void => {
    const override = options.severities && Object.hasOwn(options.severities, code) ? options.severities[code] : undefined;
    const effective = protectedCodes.has(code) ? 'error' : override ?? severity;
    if (effective === 'off') return;
    if (effective === 'error') hasError = true;
    if (issues.length >= limits.maxIssues) { truncated = true; return; }
    issues.push({ code, path, severity: effective, message });
  };
  let data: unknown;
  try { data = snapshot(input, limits); } catch (error) {
    return failure(error instanceof InputError ? error.code : 'UNSAFE_INPUT', error instanceof InputError ? error.message : 'Input could not be inspected safely.');
  }
  const requireObject = (value: unknown, path: string): value is Obj => {
    if (!object(value)) { add(value === undefined ? 'SCHEMA_REQUIRED' : 'SCHEMA_TYPE', path, 'Expected an object.'); return false; } return true;
  };
  const string = (obj: Obj, key: string, path: string, required = true): string | undefined => {
    const value = obj[key];
    if (value === undefined && !required) return undefined;
    if (typeof value !== 'string' || !value.trim()) { add(value === undefined ? 'SCHEMA_REQUIRED' : 'SCHEMA_TYPE', path, 'Expected a non-empty string.'); return undefined; }
    return value;
  };
  const decimal = (obj: Obj, key: string, path: string, required = true, negative = options.allowNegative ?? false): bigint | undefined => {
    const value = obj[key];
    if (value === undefined && !required) return undefined;
    if (value === undefined) { add('SCHEMA_REQUIRED', path, 'A decimal value is required.'); return undefined; }
    let number: bigint;
    try { number = parseDecimal(value as Decimal); } catch { add('INVALID_NUMBER', path, 'Use a finite plain decimal with at most 15 integral and 12 fractional digits.'); return undefined; }
    if (number < 0n && !negative) add('NEGATIVE_AMOUNT', path, 'Negative values require allowNegative.');
    return number;
  };
  const round = (value: bigint): bigint => quantize(value, precision, rounding);
  const compare = (value: bigint | undefined, expected: bigint, path: string): void => { if (value !== undefined && round(value) !== expected) add('AMOUNT_MISMATCH', path, 'Amount does not match the configured calculation and rounding policy.'); };
  const result = (): ValidationResult => ({ valid: !hasError, issues, truncated });
  if (!requireObject(data, '')) return result();
  const id = string(data, 'id', 'id');
  if (id !== undefined && !regexTest(options.identifierPattern ?? /^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/, id)) add('INVALID_ID', 'id', 'Invoice identifier does not match the configured pattern.');
  const date = string(data, 'date', 'date'), due = string(data, 'dueDate', 'dueDate', false);
  if (date !== undefined && !dateValid(date)) add('INVALID_DATE', 'date', 'Use a real calendar date in YYYY-MM-DD format.');
  if (due !== undefined && !dateValid(due)) add('INVALID_DATE', 'dueDate', 'Use a real calendar date in YYYY-MM-DD format.');
  if (date && due && dateValid(date) && dateValid(due) && due < date) add('DATE_ORDER', 'dueDate', 'Due date precedes invoice date.');
  const currency = string(data, 'currency', 'currency');
  if (currency !== undefined && !/^[A-Z]{3}$/.test(currency)) add('INVALID_CURRENCY', 'currency', 'Use a three-letter uppercase currency code.');
  for (const role of ['supplier', 'customer'] as const) {
    const party = data[role];
    if (!requireObject(party, role)) continue;
    string(party, 'name', `${role}.name`);
    for (const key of ['country', 'stateCode', 'gstin'] as const) string(party, key, `${role}.${key}`, false);
    const rule = options.identifiers?.[role];
    const identifier = string(party, 'identifier', `${role}.identifier`, rule?.required ?? false);
    if (identifier !== undefined && rule && !regexTest(rule.pattern, identifier)) add('IDENTIFIER_INVALID', `${role}.identifier`, 'Party identifier does not match the configured pattern.');
  }
  if (data.india !== undefined && requireObject(data.india, 'india')) {
    string(data.india, 'placeOfSupply', 'india.placeOfSupply', false);
    if (data.india.reverseCharge !== undefined && typeof data.india.reverseCharge !== 'boolean') add('SCHEMA_TYPE', 'india.reverseCharge', 'Expected a boolean.');
    if (data.india.supplyType !== undefined && (typeof data.india.supplyType !== 'string' || !['intra', 'inter', 'unknown'].includes(data.india.supplyType))) add('SCHEMA_TYPE', 'india.supplyType', 'Expected intra, inter or unknown.');
  }
  let subtotal = 0n, discounts = 0n, lineTax = 0n;
  const groups = new Map<string, bigint>(); let arithmeticReady = true;
  if (!Array.isArray(data.items)) { add(data.items === undefined ? 'SCHEMA_REQUIRED' : 'SCHEMA_TYPE', 'items', 'Expected an array of line items.'); arithmeticReady = false; }
  else if (data.items.length === 0 || data.items.length > limits.maxItems) { add('INPUT_LIMIT', 'items', 'Invoice must contain 1 to maxItems line items.'); arithmeticReady = false; }
  else for (const [i, item] of data.items.entries()) {
    const path = `items[${i}]`;
    if (!requireObject(item, path)) { arithmeticReady = false; continue; }
    string(item, 'description', `${path}.description`); string(item, 'hsn', `${path}.hsn`, false);
    const qty = decimal(item, 'quantity', `${path}.quantity`), price = decimal(item, 'unitPrice', `${path}.unitPrice`);
    const net = decimal(item, 'netAmount', `${path}.netAmount`), total = decimal(item, 'total', `${path}.total`);
    if (qty === 0n && options.allowZeroQuantity === false) add('ZERO_QUANTITY', `${path}.quantity`, 'Zero quantity is disabled.');
    let gross: bigint | undefined, discount = 0n;
    if (qty !== undefined && price !== undefined) gross = moneyProduct(qty, price, precision, rounding);
    if (item.discount !== undefined) {
      if (requireObject(item.discount, `${path}.discount`)) {
        const kind = item.discount.kind;
        if (kind !== 'amount' && kind !== 'percent') add('SCHEMA_TYPE', `${path}.discount.kind`, 'Expected amount or percent.');
        const value = decimal(item.discount, 'value', `${path}.discount.value`, true, true);
        if (value !== undefined) {
          if (kind === 'percent') {
            if (value < 0n || value > 100n * SCALE) add('DISCOUNT_RANGE', `${path}.discount.value`, 'Percentage discount must be between 0 and 100.');
            if (gross !== undefined) discount = moneyPercentage(gross, value, precision, rounding);
          } else if (kind === 'amount') {
            discount = round(value);
            if (gross !== undefined && ((gross >= 0n && (discount < 0n || discount > gross)) || (gross < 0n && (discount > 0n || discount < gross)))) add('DISCOUNT_RANGE', `${path}.discount.value`, 'Amount discount must have the gross amount sign and cannot exceed its magnitude.');
          }
        } else arithmeticReady = false;
      } else arithmeticReady = false;
    }
    const expectedNet = gross === undefined ? undefined : gross - discount;
    if (expectedNet !== undefined) compare(net, expectedNet, `${path}.netAmount`);
    let taxes = 0n;
    if (item.taxes !== undefined && !Array.isArray(item.taxes)) { add('SCHEMA_TYPE', `${path}.taxes`, 'Expected an array of tax components.'); arithmeticReady = false; }
    else if (Array.isArray(item.taxes)) {
      if (item.taxes.length > limits.maxTaxesPerItem) { add('INPUT_LIMIT', `${path}.taxes`, 'Too many tax components.'); arithmeticReady = false; }
      else {
        const seen = new Set<string>();
        for (const [t, tax] of item.taxes.entries()) {
          const tp = `${path}.taxes[${t}]`;
          if (!requireObject(tax, tp)) { arithmeticReady = false; continue; }
          const code = string(tax, 'code', `${tp}.code`), rate = decimal(tax, 'rate', `${tp}.rate`, true, true), amount = decimal(tax, 'amount', `${tp}.amount`);
          if (code !== undefined && (!/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(code) || seen.has(code.toUpperCase()))) add('INVALID_ID', `${tp}.code`, 'Use a unique tax code of at most 32 ASCII characters per item.');
          if (code !== undefined) seen.add(code.toUpperCase());
          if (rate !== undefined && (rate < 0n || rate > 100n * SCALE)) add('TAX_RATE_RANGE', `${tp}.rate`, 'Tax rate must be between 0 and 100.');
          if (rate !== undefined && expectedNet !== undefined) {
            const expected = moneyPercentage(expectedNet, rate, precision, rounding);
            compare(amount, expected, `${tp}.amount`); lineTax += expected;
            if (code !== undefined) { const key = `${code.toUpperCase()}:${rate}`; groups.set(key, (groups.get(key) ?? 0n) + expectedNet * rate); }
          } else arithmeticReady = false;
          if (amount !== undefined) taxes += round(amount); else arithmeticReady = false;
        }
      }
    }
    if (expectedNet !== undefined) { compare(total, expectedNet + taxes, `${path}.total`); subtotal += gross ?? 0n; discounts += discount; }
    else arithmeticReady = false;
    if (net === undefined || total === undefined) arithmeticReady = false;
    if ((gross !== undefined && (gross > 999999999999999n * SCALE || gross < -999999999999999n * SCALE))) { add('INVALID_NUMBER', path, 'Calculated line amount exceeds supported magnitude.'); arithmeticReady = false; }
  }
  let taxTotal = lineTax;
  if (options.taxRounding === 'invoice') {
    taxTotal = 0n;
    const factor = 10n ** BigInt(12 - precision);
    // Single rounding after summing exact numerators, without truncating fractional rates.
    // Group numerator has scale 24 and percentage divisor 100.
    for (const numerator of groups.values()) taxTotal += divideTax(numerator, factor, rounding);
  }
  if (requireObject(data.totals, 'totals')) {
    const statedSub = decimal(data.totals, 'subtotal', 'totals.subtotal'), statedDiscount = decimal(data.totals, 'discount', 'totals.discount', false, true);
    const statedTax = decimal(data.totals, 'tax', 'totals.tax'), statedTotal = decimal(data.totals, 'total', 'totals.total');
    const adjustment = decimal(data.totals, 'rounding', 'totals.rounding', false, true) ?? 0n;
    if (arithmeticReady) {
      compare(statedSub, subtotal, 'totals.subtotal'); compare(statedDiscount ?? 0n, discounts, 'totals.discount');
      compare(statedTax, taxTotal, 'totals.tax'); compare(statedTotal, subtotal - discounts + taxTotal + round(adjustment), 'totals.total');
      if ([subtotal, discounts, taxTotal, subtotal - discounts + taxTotal + round(adjustment)].some(n => n > 999999999999999n * SCALE || n < -999999999999999n * SCALE)) add('INVALID_NUMBER', 'totals', 'Calculated totals exceed supported magnitude.');
    }
  }
  // Structural errors prevent typed extensions from seeing malformed objects.
  if (!issues.some(issue => protectedCodes.has(issue.code)) && !truncated) {
    const context = Object.freeze({ precision, rounding, equalAmounts(a: Decimal, b: Decimal): boolean { return round(parseDecimal(a)) === round(parseDecimal(b)); } });
    for (const rule of options.rules ?? []) {
      try {
        const output: unknown = rule.validate(data as unknown as Invoice, context);
        if (output instanceof Promise) { void output.catch(() => undefined); throw new Error('Async rules are unsupported'); }
        if (!Array.isArray(output) || output.length > HARD_LIMITS.maxIssues) throw new Error('Invalid rule result');
        // Snapshot stops rule outputs carrying getters, cycles or unsafe serializable values.
        const safe = snapshot(output, limits) as unknown[];
        for (const issue of safe) {
          if (!object(issue) || typeof issue.code !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(issue.code) || typeof issue.path !== 'string' || typeof issue.message !== 'string' || !['error', 'warning', 'info'].includes(String(issue.severity))) throw new Error('Invalid rule issue');
        }
        for (const issue of safe as unknown as ValidationIssue[]) add(issue.code, issue.path, issue.message, issue.severity);
      } catch { add('RULE_FAILURE', '', 'A custom validation rule failed or returned invalid issues.'); }
    }
  }
  return result();
}

function divideTax(numerator: bigint, factor: bigint, mode: NonNullable<ValidationOptions['rounding']>): bigint { return divideRounded(numerator, 100n * SCALE * factor, mode) * factor; }

export function validateInvoiceJson(json: string, options: ValidationOptions = {}): ValidationResult {
  let limits: Limits;
  try { limits = configuration(options); } catch { return failure('INVALID_OPTIONS', 'Invalid validator configuration.'); }
  if (typeof json !== 'string') return failure('INVALID_JSON', 'Expected JSON text.');
  if (json.length > limits.maxJsonLength) return failure('INPUT_LIMIT', 'JSON text exceeds length limit.');
  let input: unknown;
  try { input = JSON.parse(json); } catch { return failure('INVALID_JSON', 'Input is not valid JSON.'); }
  return validateInvoice(input, options);
}
export function createValidator(options: ValidationOptions = {}): (input: unknown) => ValidationResult {
  // Options and custom rule functions are trusted application code. Validate on each call.
  return (input: unknown): ValidationResult => validateInvoice(input, options);
}
