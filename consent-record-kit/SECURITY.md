# Security policy

## Supported versions

The project currently declares Node.js `>=22` in `package.json`. Security fixes should target the current package release. The project has not yet published a support window for older releases; users should upgrade to the latest release when one is available.

## Reporting a vulnerability

Please report suspected vulnerabilities privately through the contact channel published on the Brownsmith Dynamics website: <https://brownsmithdynamics.com/>. Do not post credentials, personal data, or exploit details in a public issue. Include the affected package version, Node.js version, a concise impact description, and a minimal reproduction that uses synthetic data.

The project has not yet published a dedicated security email address, response-time commitment, or coordinated disclosure timeline. Maintainers should establish and verify a private reporting channel and disclosure process before the first public release. Do not assume that a website contact form is an encrypted vulnerability intake channel.

## Scope and security model

Consent Record Kit is a Node.js library for creating, validating, serializing, hashing, and HMAC-authenticating consent records. It does not automatically store records, send them over a network, or collect telemetry. Applications that persist or transmit records are responsible for access control, encryption in transit and at rest, retention, backups, deletion, key management, and incident response.

SHA-256 hashes detect changes only when the expected digest is protected separately. HMAC authentication requires a secret key protected by the integrating application. A party that can modify both a record and its expected digest, or can obtain the HMAC key, can defeat those checks. The library does not provide asymmetric signatures, trusted timestamps, key distribution, replay prevention across systems, or a hosted audit service.

This library is not a legal compliance determination and does not decide whether a consent request or processing purpose is lawful.
