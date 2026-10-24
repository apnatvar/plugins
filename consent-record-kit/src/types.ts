export const SCHEMA_VERSION = '1.0' as const;
export interface Subject { readonly namespace: string; readonly id: string }
export interface Purpose { readonly id: string; readonly granted: boolean }
export interface Receipt {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly type: 'consent' | 'withdrawal' | 'supersession';
  readonly id: string;
  readonly timestamp: string;
  readonly subject: Subject;
  readonly policyVersion: string;
  readonly purposes: readonly Purpose[];
  readonly previousRecordId?: string;
}
export interface ReceiptInput {
  readonly id?: string;
  readonly timestamp?: string;
  readonly subject: Subject;
  readonly policyVersion: string;
  readonly purposes: readonly Purpose[];
}
export interface ValidationIssue { readonly path: string; readonly code: string; readonly message: string }
export interface VerificationResult { readonly valid: boolean; readonly errors: readonly ValidationIssue[] }
export interface AuthenticatedReceipt {
  readonly receipt: Receipt;
  readonly authentication: { readonly algorithm: 'HMAC-SHA-256'; readonly keyId: string; readonly tag: string };
}
/** Implement insert atomically; never overwrite a duplicate ID. No adapter runs automatically. */
export interface StorageAdapter {
  insert(receipt: Receipt | AuthenticatedReceipt): Promise<'inserted' | 'duplicate'>;
  get(id: string): Promise<Receipt | AuthenticatedReceipt | undefined>;
}
