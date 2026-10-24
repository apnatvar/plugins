# Security policy

## Scope

Invoice Rules accepts caller-provided invoice values and returns validation results. It is intended to run locally and has no network or filesystem access. The validator must treat input as untrusted: getters, unusual prototypes, cycles, dangerous property names, oversized values, and invalid numeric forms can create surprising behavior or resource use.

The implementation inspects own data properties without invoking accessors, rejects hidden, accessor, symbol, sparse, cyclic, non-plain, and dangerous-key structures, enforces configurable limits, uses bounded decimal arithmetic, and provides custom rules with a frozen defensive snapshot. A JavaScript `Proxy` can run code when inspected; no in-process validator can sandbox arbitrary proxy traps. These safeguards reduce exposure to malformed data; they do not make arbitrary custom rule code safe. Custom rules and regular expressions execute in the host process with the host application's permissions.

## Safe use

- Keep limits appropriate to the service's request size and workload.
- Do not treat a valid result as proof that an invoice is genuine, paid, tax-compliant, or legally sufficient.
- Do not run untrusted custom rules or regular expressions. A trusted regular expression can still be vulnerable to catastrophic backtracking.
- Handle `truncated: true` as an incomplete report. Do not assume omitted issues are absent.
- Consider process-level request, memory, and execution time limits when validating data from the public internet.
- Keep validation and accounting posting as separate operations; review amounts and tax decisions in the system of record.

## Reporting a vulnerability

Please report suspected vulnerabilities privately to contact@brownsmithdynamics.com with subject `Invoice Rules security`. Include the affected version, a minimal reproducer, the expected impact, and any safe mitigation. Do not include real customer invoices or personal data. Do not open a public issue containing exploit details before maintainer review. No response-time guarantee is made.

## Assessment and verification approach

| Threat | Control and verification |
| --- | --- |
| Prototype pollution | Recursive dangerous-key and prototype rejection; no merging of invoice values into options or prototypes; tests for JSON `__proto__`, custom prototypes and nested keys. |
| Malicious nested input | Depth/node/string/array limits, cycle detection and descriptor inspection; tests for getters, sparse arrays, hidden keys and recursive structures. |
| Invalid numeric values, overflow, precision loss | Bounded fixed-scale BigInt parsing and exact rounding numerators; tests for nonfinite values, malformed decimals, refund signs, products and aggregate overflow. |
| Massive invoices | Item/tax/node/JSON/issue bounds; tests exercise limits without requiring a massive allocation. No timing guarantee for arbitrary in-memory JavaScript objects or trusted rules. |
| Unsafe error serialization | Fixed built-in messages omit invoice values; custom issues are copied and validated, extra fields discarded; thrown exception text is not returned. |
| Dependency vulnerabilities | No runtime dependencies; pinned TypeScript compiler; lockfile, Dependabot and explicit release audit of development dependencies. A passing audit is a point-in-time check. |
| Unexpected mutation | Only immutable snapshots reach extensions; tests compare caller input before and after and attempt nested writes. |
| Incorrect identifier acceptance | Calendar/ID/party regex tests; GSTIN shape/check-character tests with documented variant and registration limits. No format check establishes legal identity. |

See `test/security.test.mjs`, `test/edge-cases.test.mjs`, and `test/india.test.mjs`. Verification outcomes for this implementation are recorded separately in `docs/VERIFICATION.md` in the source checkout; do not read this assessment as a certification or an external penetration test.

## Supported versions

Until the first release, only the current development version is supported. After release, fixes will be made to the latest published version; the project may publish security fixes for older versions at maintainer discretion.
