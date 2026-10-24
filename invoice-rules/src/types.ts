/** Decimal strings are recommended. Numbers must be finite, plain decimals within safe range. */
export type Decimal = string | number;
export type Severity = 'error' | 'warning' | 'info' | 'off';
export type RoundingMode = 'half-up' | 'half-even' | 'toward-zero';
export interface Party { name: string; identifier?: string; country?: string; stateCode?: string; gstin?: string }
export interface Tax { code: string; rate: Decimal; amount: Decimal }
export interface Discount { kind: 'amount' | 'percent'; value: Decimal }
export interface LineItem {
  description: string; quantity: Decimal; unitPrice: Decimal; discount?: Discount;
  netAmount: Decimal; taxes?: Tax[]; total: Decimal; hsn?: string;
}
export interface Invoice {
  id: string; date: string; dueDate?: string; currency: string;
  supplier: Party; customer: Party; items: LineItem[];
  totals: { subtotal: Decimal; discount?: Decimal; tax: Decimal; total: Decimal; rounding?: Decimal };
  india?: { placeOfSupply?: string; reverseCharge?: boolean; supplyType?: 'intra' | 'inter' | 'unknown' };
}
export interface ValidationIssue { code: string; path: string; severity: Exclude<Severity, 'off'>; message: string }
export interface ValidationResult { valid: boolean; issues: ValidationIssue[]; truncated: boolean }
export interface Limits { maxItems: number; maxTaxesPerItem: number; maxDepth: number; maxNodes: number; maxStringLength: number; maxJsonLength: number; maxIssues: number }
export interface RuleContext {
  readonly precision: number; readonly rounding: RoundingMode;
  /** Compare rounded currency amounts using this validator's precision and policy. */
  equalAmounts(a: Decimal, b: Decimal): boolean;
}
export interface CustomRule {
  id: string;
  validate(invoice: Readonly<Invoice>, context: RuleContext): readonly ValidationIssue[];
}
export interface IdentifierRule { pattern: RegExp; required?: boolean }
export interface ValidationOptions {
  precision?: number; rounding?: RoundingMode; taxRounding?: 'line' | 'invoice';
  allowNegative?: boolean; allowZeroQuantity?: boolean;
  identifierPattern?: RegExp;
  identifiers?: { supplier?: IdentifierRule; customer?: IdentifierRule };
  severities?: Readonly<Record<string, Severity>>;
  limits?: Partial<Limits>;
  rules?: readonly CustomRule[];
}
