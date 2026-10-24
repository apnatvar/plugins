# Consent Record Kit

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)

A free, privacy-first TypeScript library by [Brownsmith Dynamics](https://brownsmithdynamics.com) for constructing, serializing, hashing, authenticating, and validating technical records of consent. Node.js 22+, ESM, MIT, zero runtime dependencies. No network calls, telemetry, IP addresses, user agents, database, or automatic persistence.

**An authenticated record does not independently establish user identity, informed or freely given consent, or regulatory compliance.** This is not a banner, consent management platform, trusted timestamp service, or legal certification. SHA-256 alone is not authentication: anyone can edit a record and compute a new digest.

## Installation and release status

Version 0.1.0 is implemented locally and **not published**. The owner confirmed `@brownsmithdynamics/consent-record-kit` after public metadata verified that organization endpoint and the original misspelled scope returned 404. Publishing permission for npm user `apnatva` still needs verification before release. There is no verified live npm listing to link to. Once published under the confirmed name:

```sh
npm install @brownsmithdynamics/consent-record-kit
```

Until then, build with `npm ci --ignore-scripts && npm run build`, run `npm pack --ignore-scripts`, and install the local tarball in a consumer. The [repository root](https://github.com/apnatvar/plugins) is verified; these local changes have not been pushed. Only the MIT badge above describes an established fact. Build/test badges cannot honestly show a passing remote CI run before the workflow is pushed; an npm version badge cannot honestly show an unpublished version. Add those badges only after verifying the live workflow and registry listing. See [PUBLISHING.md](PUBLISHING.md).

## Create and verify a receipt

```ts
import { randomBytes } from 'node:crypto';
import {
  createReceipt, canonicalize, hashReceipt, verifyIntegrity,
  authenticateReceipt, verifyAuthenticatedReceipt, parseReceipt,
} from '@brownsmithdynamics/consent-record-kit';

const receipt = createReceipt({
  subject: { namespace: 'account', id: 'opaque-application-reference' },
  policyVersion: 'privacy-notice-2026-10',
  purposes: [
    { id: 'analytics', granted: true },
    { id: 'marketing', granted: false },
  ],
});
const json = canonicalize(receipt);
const restored = parseReceipt(json);
const digest = await hashReceipt(restored);
const integrity = await verifyIntegrity(restored, digest);

// Example only: production keys come from a protected secret manager.
const key = randomBytes(32);
const envelope = await authenticateReceipt(restored, key, 'consent-key-2026-10');
const verification = await verifyAuthenticatedReceipt(envelope, key);
if (!verification.valid) throw new Error('Receipt authentication failed');
```

Verify before using untrusted records. Verification returns `{valid, errors}` and never treats a digest as proof of collection. Authentication requires a trusted mapping from a permitted `keyId` to a secret; do not fetch arbitrary key URLs supplied by a record. HMAC validates possession of a shared key, not a particular signer. Anyone holding that key can forge any record, including backdated records.

## Schema and canonical serialization

Schema `1.0` contains `schemaVersion`, `type`, `id`, `timestamp`, `subject`, `policyVersion`, and `purposes`. Linked records additionally contain `previousRecordId`. Unknown fields and schema versions are rejected. There is intentionally no arbitrary metadata bag. Policy text and UI evidence belong in the integrating system; retain the exact versioned notices that the labels refer to.

- IDs default to cryptographically random UUID v4. Caller IDs must be lowercase UUID v4; caller uniqueness and entropy are not provable by syntax validation.
- Timestamps default to the local clock. Caller timestamps must be exact UTC `YYYY-MM-DDTHH:mm:ss.sssZ` calendar values. Future dates are allowed. Applications enforce trusted time, age windows, clock skew, and backdating policies.
- Subject namespace (1–64 UTF-16 code units), subject ID (1–256), policy version (1–128), and purpose ID (1–128) are nonempty, trimmed strings without controls or lone surrogates. Unicode characters are supported; strings are not normalized. No identifier is resolved or identity-verified.
- Each receipt has 1–64 independently chosen purposes; each has a unique `id` and explicit boolean `granted`. Denial is representable. Creation snapshots and deeply freezes data without modifying caller input.
- Canonical serialization sorts object keys and purpose IDs by JavaScript UTF-16 code-unit order, uses JSON string escaping, preserves Unicode spelling, and contains no whitespace. UTF-8 bytes of this text are hashed. These rules are specific to schema 1.0, not a claim of general RFC 8785 compatibility.
- `parseReceipt` accepts **only this exact canonical JSON spelling**. Whitespace, alternate property order, escapes, duplicate keys, and unsorted purposes are rejected. Use `canonicalize` for already-parsed trusted plain objects. This restriction avoids cross-parser ambiguity. Maximum input is 65,536 UTF-8 bytes; callers may lower that limit.

For fixed values, byte-for-byte output is deterministic across supported runtimes. Defaults intentionally introduce time and randomness, so supply both when reproducing a record. See [canonical vector](docs/CANONICALIZATION.md).

## Withdrawal and supersession

```ts
import { createWithdrawal, supersedeReceipt } from '@brownsmithdynamics/consent-record-kit';

const withdrawal = createWithdrawal(receipt, { purposes: ['analytics'] });
// type='withdrawal', previousRecordId=receipt.id, analytics granted=false.
const replacement = supersedeReceipt(receipt, {
  subject: receipt.subject,
  policyVersion: 'privacy-notice-2026-11',
  purposes: [{ id: 'analytics', granted: false }, { id: 'marketing', granted: true }],
});
```

A withdrawal records selected prior granted purposes; other choices are unaffected. A supersession is a complete new set of decisions. Both require a distinct ID, matching subject, and timestamp at or after the prior record. A withdrawal cannot itself be used as the prior consent; load its referenced consent/supersession for further changes. Constructors check a single supplied link, not the full authenticated chain. Authenticate every event separately.

No function stops processing, revokes another system's permission, or changes existing records. A storage transaction must serialize updates, verify the authoritative prior record and its authentication, reject stale versions, and apply withdrawal effects. Repeated calls and verification are stateless; duplicates and replays remain valid cryptographically. Define current-state and conflict rules in your application.

## API reference

| Export | Contract |
| --- | --- |
| `createReceipt(input): Receipt` | Subject, policyVersion, purposes; optional id/timestamp. Creates consent snapshot. |
| `createWithdrawal(previous, {purposes, id?, timestamp?}): Receipt` | Purpose IDs to withdraw; creates linked partial withdrawal. |
| `supersedeReceipt(previous, input): Receipt` | Full replacement input; creates linked supersession. |
| `canonicalize(receipt): string` | Validate and serialize canonical schema 1.0 text. |
| `exportReceipt(receipt): string` | Alias for canonicalize, suitable for JSON storage/export. |
| `parseReceipt(json, {maxBytes?}?): Receipt` | Parse bounded canonical JSON into a frozen snapshot. |
| `validateReceipt(unknown): VerificationResult` | `{valid:boolean, errors:ValidationIssue[]}`; fails closed. |
| `hashReceipt(receipt): Promise<string>` | Lowercase 64-character SHA-256 hex of canonical UTF-8. |
| `verifyIntegrity(receipt, digest): Promise<VerificationResult>` | Validate and compare a trusted digest. |
| `authenticateReceipt(receipt, key, keyId): Promise<AuthenticatedReceipt>` | HMAC-SHA-256 with caller-supplied 32–4096 byte Uint8Array and 1–128 character keyId. |
| `verifyAuthenticatedReceipt(unknown, key): Promise<VerificationResult>` | Validate exact envelope, algorithm, record and MAC; malformed inputs return errors. |
| `SCHEMA_VERSION`, `MAX_RECEIPT_BYTES` | `'1.0'`, `65536`. |
| `ValidationError` | Constructors, parsing, serialization, hashing, and authentication reject invalid inputs with `.errors`. |
| `Receipt`, `ReceiptInput`, `Subject`, `Purpose`, `WithdrawalInput` | Readonly TypeScript types. |
| `AuthenticatedReceipt`, `VerificationResult`, `ValidationIssue`, `StorageAdapter` | Envelope, result, error and optional storage contracts. |

Errors contain a field `path`, machine-readable `code`, and safe `message`; they do not echo secrets or supplied values. Validation returns the first detected issue. Ordinary JSON-like inputs are supported; arbitrary executing JavaScript proxies are outside the security boundary.

An envelope is `{receipt, authentication:{algorithm:'HMAC-SHA-256', keyId, tag}}`. Its MAC covers the UTF-8 domain prefix `ConsentRecordKit:HMAC:v1\n` followed by canonical JSON `{algorithm, keyId, receipt}`. Algorithm and key ID are authenticated as well as the receipt. Only HMAC-SHA-256 is supported; no asymmetric signature or algorithm negotiation is provided.

## Keys, privacy and storage

Generate random secrets of at least 32 bytes using a platform CSPRNG. Keep them in a server-side secret manager, separate from receipts, source, logs, browser bundles and storage backups. Do not encode a password as a key. The API accepts bytes rather than guessing encodings. Rotate key IDs with an allowlisted lookup; retain old verification keys according to retention policy and define revocation behavior. The library copies and clears its temporary key buffer, but JavaScript cannot guarantee erasure and caller-owned secrets remain the caller's responsibility. Structurally valid MACs are compared using the platform timing-safe primitive; input parsing and invalid-length rejection are not constant-time.

Opaque identifiers may still be personal data when linkable. Pseudonymization is not anonymization. Choose purpose and policy labels that disclose no unnecessary information. The library collects and transmits nothing; integrating applications control collection, encryption at rest, access control, retention, exports, erasure, backups, consent UI, and data-subject rights. Do not put keys in exported receipts. A withdrawal is an event, not a deletion mechanism.

`StorageAdapter` is a TypeScript-only interface: `insert(receiptOrEnvelope)` returns a promise of `'inserted' | 'duplicate'`; `get(id)` returns a promise of an optional record/envelope. Implement atomic unique insertion. No adapter is bundled or invoked automatically. Real storage also needs authorization, concurrency control, idempotency, authenticated history and encryption. See [integration example](examples/server.mjs).

No separate end-user collection policy is triggered solely by this pure library's behavior, since it has no telemetry or hosted service. Its privacy statement is above. The documentation website and support channels require their own assessment of hosting logs, cookies, analytics, inquiries and applicable transparency obligations. See [publication and legal findings](PUBLISHING.md), [security policy](SECURITY.md), and [assessment](docs/SECURITY_ASSESSMENT.md).

## Development

Complete source, tests and docs before checks. Then run `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, `npm audit --audit-level=low`, `npm pack --dry-run --ignore-scripts`, and `npm run check:consumer`. CI performs these checks with read-only repository permissions and has no publish job or npm secrets. Publication is manual, with 2FA, after the [release checklist](RELEASE_CHECKLIST.md). See [CONTRIBUTING.md](CONTRIBUTING.md) and [CHANGELOG.md](CHANGELOG.md).
