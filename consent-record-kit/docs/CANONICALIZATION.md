# Canonical schema 1.0

Keys and purpose IDs sort ascending by UTF-16 code unit, without locale rules or normalization. JSON string escaping follows ECMAScript JSON.stringify. Arrays contain no holes. Booleans remain booleans; there are no numeric fields. UTF-8 encoding is used for all cryptographic operations. Supplementary characters are accepted when paired; unpaired surrogates and controls are rejected. All fields are bounded. This is a schema-specific format, not a generic arbitrary JSON canonicalizer.

Fixed record:

```json
{"id":"7a6c7e3e-79a6-4f93-8f7e-f15f16e4b421","policyVersion":"2026-04","purposes":[{"granted":true,"id":"analytics"},{"granted":false,"id":"email"}],"schemaVersion":"1.0","subject":{"id":"user-42","namespace":"crm"},"timestamp":"2026-04-20T10:11:12.123Z","type":"consent"}
```

The enclosing Markdown fence and trailing newline are not part of the canonical bytes. Tests compare a literal golden vector against these rules, independently compute SHA-256 and HMAC with platform APIs, and permute field/purpose order. Creation defaults must be fixed to reproduce bytes. MAC input is `ConsentRecordKit:HMAC:v1` plus a newline followed by canonical `{algorithm,keyId,receipt}`. `keyId` is part of the authenticated message. Envelope field ordering does not matter after parsing; receipt parser input must already be canonical. Schema or algorithm changes require explicit new versions and vectors.
