# Static security assessment

**Status: pending maintainer review.** This document records a design and source-level assessment. It does not claim that tests, fuzzing, dependency review, a security audit, or independent verification have been completed. Recheck these statements against the release candidate before publication.

Subsequent local automated results, including the unit/security suite, dependency audit and packaged consumer check, are recorded separately in [VALIDATION.md](VALIDATION.md). This document remains a static assessment and is not an independent security audit.

## Scope and assumptions

The package is a Node.js library with a declared engine requirement of Node.js `>=22`. The assessment covers the current `src/` implementation and `package.json` as inspected for this document. It assumes the JavaScript runtime and Node built-in crypto implementation are not compromised.

The input boundary differs by API:

- `parseReceipt` accepts JSON text, limits input to at most 65,536 UTF-8 bytes (a caller may select a lower limit), parses with `JSON.parse`, validates the parsed data, and requires the original text to equal the canonical representation. It rejects duplicate-key spellings and noncanonical whitespace/order/escaping.
- APIs that receive JavaScript objects validate own property descriptors and reject unexpected fields, symbols, accessors, non-enumerable properties, and exotic prototypes. JavaScript `Proxy` traps can execute during reflection; an in-process Proxy is not a trust boundary. Treat JSON text parsed by the library as the hostile-input boundary, and do not treat arbitrary live object references from hostile same-process code as isolated data.

## Security-relevant design

- Identifiers default to Node's `crypto.randomUUID()` and validation accepts lowercase UUID version 4 identifiers.
- Cryptographic operations use Node built-in `crypto`: SHA-256 `createHash`, HMAC-SHA-256 `createHmac`, and `timingSafeEqual` for fixed-length hexadecimal digest/tag comparisons.
- Receipt snapshots contain the schema fields and are frozen, including nested subject and purpose objects. Purpose entries are sorted by purpose ID using JavaScript string ordering. Canonical object keys use JavaScript's default UTF-16 code-unit ordering. The format performs no Unicode normalization; visually equivalent strings can therefore remain byte-distinct.
- Receipt parsing is bounded by the 65,536-byte maximum. The schema bounds purpose count to 1–64; purpose IDs to 128 code units; subject namespace to 64; subject ID to 256; policy version and key ID to 128. Strings must be nonempty, trimmed, and free of control characters and unpaired surrogates.
- HMAC input has the domain prefix `ConsentRecordKit:HMAC:v1\n`, followed by canonical JSON for `{algorithm, keyId, receipt}`. SHA-256 alone is an integrity digest, not an authenticity proof. HMAC authenticates only when the secret key remains secret and the expected `keyId` maps to the intended key.
- HMAC keys must be `Uint8Array` values from 32 through 4,096 bytes. The implementation copies the supplied key into a local Buffer and clears that copy in a `finally` block. This is best-effort cleanup: JavaScript and the runtime may retain copies, and the caller's original key remains present and must be protected and cleared by its owner.
- The library defines a storage adapter contract but does not automatically invoke a storage backend. It has no default data collection, persistence, telemetry, or network transport.
- Linked records carry `previousRecordId`; the library checks local link construction constraints such as matching subject, distinct IDs, and nondecreasing timestamps. Replay detection, chain completeness, ordering across distributed systems, and storage atomicity remain application-side responsibilities. The library does not authenticate clock time or provide a trusted timestamp.

## Threats and limits

| Threat | Relevant control or limit | Remaining responsibility |
| --- | --- | --- |
| Oversized or ambiguous serialized input | `parseReceipt` applies the byte cap and demands canonical JSON after parsing. | The caller should keep the cap at or below the package maximum and bound surrounding transport/request bodies too. |
| Unexpected object properties changing the signed record | Validation rejects unknown fields, symbols, accessors, non-enumerable properties, and non-plain prototypes; snapshots copy schema fields. | Do not pass live objects controlled by hostile code in the same process. Proxy reflection can run traps and is outside this boundary. |
| Accidental or malicious post-creation mutation | Receipt snapshots and nested records are frozen. | Freezing is not a substitute for protecting data after serialization or storage. |
| Unauthorized record modification | SHA-256 can detect a changed record if the trusted digest is protected; HMAC can authenticate against holders without the secret. | Store digest/key material separately from mutable records. A compromised HMAC key, or attacker-controlled key and expected tag, defeats authenticity. |
| HMAC timing leakage | Tag/digest comparisons use `timingSafeEqual` after validating fixed-length lowercase hex. | Broader timing behavior, key lookup, error channels, and the host environment require application review. |
| Secret-key exposure | A bounded copy is cleared in `finally`. | Protect the original key, key backups, environment/configuration, logs, process memory, and rotation. JS memory erasure is not guaranteed. |
| Duplicate/replayed or reordered records | Link metadata and local construction checks are available. | Applications must enforce unique IDs, atomic insert-if-absent, replay policy, chain completeness, and cross-system ordering. No trusted clock exists. |
| Invalid consent semantics or incorrect evidence | Schema stores purpose grants, policy version, timestamp, and subject fields. | Product owners must ensure notices, purpose granularity, lawful basis, withdrawal UX, attribution, and evidence meet applicable requirements. The library does not establish legal validity. |
| Data exposure through persistence or transport | No default storage, telemetry, or network calls are provided. | Integrators control database permissions, encryption, retention/deletion, backups, logs, network security, and privacy notices for their own collection. |

## Review items before public release

- [ ] Maintainer has reviewed this document against the release source and approved the threat boundaries.
- [ ] Private vulnerability intake contact and disclosure process are verified and published.
- [ ] Release-specific artifact contents and dependency risks are reviewed.
- [ ] Any test, fuzz, audit, or review results are recorded separately with their actual date and scope; none are implied by this static assessment.
- [ ] Consumer documentation explains key custody, external storage, replay handling, and the lack of trusted timestamps/signatures.

## Source files considered

`package.json`, `src/crypto.ts`, `src/serialization.ts`, `src/validation.ts`, `src/types.ts`, `src/creation.ts`, and `src/lifecycle.ts`. This scope statement does not imply that the package has passed automated tests or external security review.
