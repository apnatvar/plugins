# Invoice Rules

![MIT license](https://img.shields.io/badge/license-MIT-blue) ![Node.js 22 or newer](https://img.shields.io/badge/node-%3E%3D22-green)

Invoice Rules validates invoice-shaped JavaScript values with deterministic decimal arithmetic. It is a library for checking data before a later application step; it does not issue invoices, calculate legally applicable tax rates, or certify compliance with a country's invoicing rules.

## Requirements

Node.js 22 or newer is required. The package is distributed as ES modules and includes TypeScript declarations. It has no runtime dependencies. Use decimal strings for money and quantities when exact decimal input matters; JavaScript numbers are accepted only when finite and within the documented decimal limits. Browser bundlers must support BigInt and ES2022; browser compatibility has not been independently tested. CommonJS `require` is not an advertised export.

## Install

The owner confirmed the package name `@brownsmithdynamics/invoice-rules`. It is not published; npm organization membership and publishing access remain unverified. Install it after publication:

```sh
npm install @brownsmithdynamics/invoice-rules
```

For local use now, run `npm ci --ignore-scripts`, `npm run build`, and `npm pack --ignore-scripts` in this directory, then install the generated `brownsmithdynamics-invoice-rules-0.1.0.tgz` by its absolute path in a consumer project.

## Quick start

```js
import { validateInvoice } from '@brownsmithdynamics/invoice-rules';

const invoice = {
  id: 'INV-2026-001',
  date: '2026-10-24',
  currency: 'USD',
  supplier: { name: 'Northwind Services' },
  customer: { name: 'Contoso Ltd' },
  items: [{
    description: 'Consulting',
    quantity: '2',
    unitPrice: '10.00',
    netAmount: '20.00',
    taxes: [{ code: 'VAT', rate: '10', amount: '2.00' }],
    total: '22.00',
  }],
  totals: { subtotal: '20.00', tax: '2.00', total: '22.00' },
};

const result = validateInvoice(invoice);
if (!result.valid) {
  for (const issue of result.issues) {
    console.error(`${issue.path}: ${issue.code} (${issue.severity}) — ${issue.message}`);
  }
}
```

`validateInvoice(input, options?)` accepts an unknown value and returns `{ valid, issues, truncated }`. Every issue has a stable `code`, a data `path`, a `severity` (`error`, `warning`, or `info`), and a human-readable `message`. `valid` is false when at least one issue has error severity. If the configured issue limit is reached, `truncated` is true.

`validateInvoiceJson(json, options?)` parses JSON and validates it. Invalid JSON produces an `INVALID_JSON` issue. `createValidator(options?)` creates a reusable function with the given options captured.

## Arithmetic and options

Defaults use two decimal places, half-up rounding, per-line tax rounding, reject negative amounts, and allow zero quantity. A line's gross amount is quantity times unit price rounded to the configured precision. A fixed discount is quantized to that precision; a percentage discount is calculated from the rounded gross and rounded once. Net amount is gross less discount, and line total adds the rounded line tax amounts. Invoice subtotal and discounts sum the corresponding line amounts. Tax rates are data supplied by the caller; this package does not infer rates from a country, product, date, or customer.

With `taxRounding: 'line'`, the invoice tax total is the sum of rounded line taxes. With `taxRounding: 'invoice'`, the expected header tax is calculated by grouping exact tax bases by tax code and rate, then rounding each group once. Each supplied line tax amount is still checked using line rounding, so the aggregate invoice tax can differ from the sum of displayed line tax amounts. Invoice total uses the selected invoice tax policy and includes the supplied rounding adjustment.

Options include:

- `precision`: currency precision from 0 through 6 decimal places.
- `rounding`: `half-up`, `half-even`, or `toward-zero`.
- `taxRounding`: `line` or `invoice` aggregation policy.
- `allowNegative`: accept negative monetary values for credit notes or refunds.
- `allowZeroQuantity`: permit lines with zero quantity.
- `identifierPattern` or per-party `identifiers`: validate supplier/customer identifiers with caller-provided regular expressions.
- `severities`: set a known issue code to `error`, `warning`, `info`, or `off`. Structural safety failures cannot be suppressed.
- `limits`: lower or raise bounded input limits such as item count, JSON length, depth, node count, string length, and issue count.
- `rules`: add custom checks. Each rule has an `id` and `validate(invoice, context)` function; it receives a frozen snapshot and returns a list of issues.

Malformed options are reported as `INVALID_OPTIONS`. Numeric inputs are finite decimal values within the supported range. Decimal strings do not accept exponent notation. For best reproducibility, pass amounts as strings such as `"125.40"`.

The maximum magnitude is `999999999999999`, with up to 12 fractional input digits. Calculated gross line amounts and header totals have the same magnitude bound. Multiplication uses exact BigInt numerators and rounds only at the specified step; intermediate products never use IEEE-754 arithmetic. Do not first compute an amount with JavaScript floating-point arithmetic: lost input precision cannot be recovered. Numbers whose string representation uses exponent syntax or exceeds the precision bounds are rejected. Strings must use plain decimal syntax: no whitespace, plus signs, thousands separators, leading zeros, or omitted integral digits.

Half-up rounds exact ties away from zero; half-even rounds ties to the nearest even minor unit; toward-zero truncates. At precision 2, `1.005` becomes `1.01`, `1.00`, or `1.00` respectively; `-1.005` becomes `-1.01`, `-1.00`, or `-1.00`. Supplied amounts are rounded before comparison, so sub-minor-unit differences may compare equal. A fixed refund discount uses the same sign as the negative gross; a percentage discount uses a positive percentage on that negative gross. Header `rounding` is a caller-supplied signed adjustment, not an automatically inferred allowance.

## Public interface

```ts
validateInvoice(input: unknown, options?: ValidationOptions): ValidationResult;
validateInvoiceJson(json: string, options?: ValidationOptions): ValidationResult;
createValidator(options?: ValidationOptions): (input: unknown) => ValidationResult;
```

The factory retains the trusted options by reference; do not mutate configuration while validating. All public model and option types are exported from the root. `createIndiaRules` and its option type are available from `/india`. There are no default exports or filesystem/network side effects.

| Field | Contract |
| --- | --- |
| `id`, `date`, `currency` | Required strings; default ID pattern allows 1–64 ASCII letters/digits plus `.`, `_`, `/`, `-`; dates are real calendar dates `0001-01-01` through `9999-12-31`; currency checks uppercase three-letter shape, not registry membership. |
| `dueDate` | Optional valid date on or after `date`. |
| `supplier`, `customer` | Required objects with non-empty `name`; optional string `identifier`, `country`, `stateCode`, `gstin`. No identity/ownership lookup is performed. |
| `items` | Required non-empty array. Each item requires `description`, `quantity`, `unitPrice`, `netAmount`, `total`; optional `discount`, `taxes`, `hsn`. |
| `discount` | `{ kind: 'amount' \| 'percent', value: Decimal }`; amount cannot exceed gross magnitude, percent is 0–100. |
| `taxes` | Optional array of `{code, rate, amount}`. Rate is caller-supplied, 0–100 inclusive; codes are case-insensitively unique per line, 1–32 ASCII letters/digits/underscore/hyphen, starting with a letter. Components are additive taxes on net amount, not compound taxes or tax-inclusive pricing. |
| `totals` | Required `subtotal`, `tax`, `total`; optional `discount` (defaults to zero), signed `rounding` (defaults to zero). |
| `india` | Optional `placeOfSupply`, `reverseCharge`, `supplyType`; see the India module below. |

All decimal fields use `string | number`. Unknown JSON-compatible fields are retained in the snapshot but have no built-in business meaning. Empty optional strings are rejected. A successful result says only that the enabled checks passed; it does not assert statutory completeness.

### Limits

| Limit | Default | Hard maximum |
| --- | ---: | ---: |
| `maxItems` | 1,000 | 10,000 |
| `maxTaxesPerItem` | 10 | 50 |
| `maxDepth` | 12 | 32 |
| `maxNodes` | 100,000 | 500,000 |
| `maxStringLength` | 4,096 | 65,536 |
| `maxJsonLength` | 2,000,000 | 10,000,000 |
| `maxIssues` | 1,000 | 10,000 |

Limits must be positive integers. Lengths count JavaScript UTF-16 code units; nodes count containers and values; root depth is zero. The JSON length bound applies before parsing. Object input is already in memory, so hosts must also bound request size before constructing objects. A truncated report can still be valid if all emitted/omitted findings have non-error severity; always inspect `truncated` when requiring a complete report.

### Errors and warnings

Paths use dot properties and indexed arrays, such as `items[0].taxes[1].amount`; an empty path identifies the whole input. Messages never interpolate invoice values. Use codes for application behavior, not message text.

| Code | Meaning |
| --- | --- |
| `SCHEMA_REQUIRED`, `SCHEMA_TYPE` | Required value missing or incompatible shape/type. |
| `INVALID_ID`, `IDENTIFIER_INVALID` | Invoice/tax code or configured party identifier invalid. |
| `INVALID_DATE`, `DATE_ORDER`, `INVALID_CURRENCY` | Calendar/date order or currency shape check failed. |
| `INVALID_NUMBER`, `NEGATIVE_AMOUNT`, `ZERO_QUANTITY` | Decimal validity/range or configured sign/quantity policy failed. |
| `DISCOUNT_RANGE`, `TAX_RATE_RANGE` | Discount or tax percentage outside supported bounds. |
| `AMOUNT_MISMATCH` | Line/header amount does not match configured arithmetic. |
| `INPUT_LIMIT`, `UNSAFE_INPUT`, `INVALID_JSON` | Resource limit, non-JSON-safe structure, or invalid JSON text. |
| `INVALID_OPTIONS`, `RULE_FAILURE` | Invalid trusted configuration or failing/invalid custom-rule result. |

All built-in findings default to error. `severities: { AMOUNT_MISMATCH: 'warning' }` permits that finding while preserving it in the report. `off` omits a finding. `SCHEMA_REQUIRED`, `SCHEMA_TYPE`, `INVALID_NUMBER`, `INPUT_LIMIT`, `UNSAFE_INPUT`, `INVALID_JSON`, `INVALID_OPTIONS`, and `RULE_FAILURE` always remain errors. Custom-rule execution is skipped after structural errors or report truncation.

### Custom rules and identifiers

```js
const result = validateInvoice(invoice, {
  identifiers: { supplier: { required: true, pattern: /^SUP-\d{3}$/ } },
  severities: { 'business.reference': 'warning' },
  rules: [{
    id: 'reference',
    validate(value, context) {
      return value.id.startsWith('INV-') ? [] : [{
        code: 'business.reference', path: 'id', severity: 'error',
        message: 'Use the configured invoice reference prefix.'
      }];
    }
  }]
});
```

Rules run synchronously on a deeply frozen defensive snapshot and return arrays of structured issues. Up to 100 rules are accepted. Async rules, thrown errors, and malformed or unsafe issue arrays become `RULE_FAILURE` without leaking exception messages. The trusted context provides `precision`, `rounding`, and `equalAmounts(a, b)` using the same currency comparison policy. Code syntax is 1–80 letters/digits/dot/underscore/hyphen, starting with a letter; result severity must be error/warning/info. Each returned message and path is subject to string bounds. Regexes run without global/sticky state, but must still be reviewed for excessive backtracking.

## Built-in checks

Built-in checks cover required fields and types, dates and date order, invoice and party identifiers, currency shape, decimal validity, negative and zero quantity policy, discount bounds, line and invoice arithmetic, configured input limits, and unsafe object structures. The validator does not fetch external data, execute invoice-provided code, or mutate the input.

The optional India module exports `isValidGstinFormat`, `hasValidGstinChecksum`, `isValidGstin`, and `createIndiaRules`. The checksum helper implements a local format check; it cannot establish that a GSTIN is registered, active, belongs to the named party, or is valid for a transaction. Those checks require authoritative external records and applicable legal interpretation. `createIndiaRules` can optionally require GSTIN, place of supply, HSN/SAC, and explicit reverse-charge status, or check GST tax labels against a caller-supplied `india.supplyType`. It does not infer transaction facts.

## Examples

See [`examples/basic-invoice.json`](examples/basic-invoice.json) for a complete valid document and [`examples/validate.mjs`](examples/validate.mjs) for a runnable validation example.

## Security and limitations

See [SECURITY.md](SECURITY.md) for the input threat model and reporting process. Treat validation as one control in an application, not as a security boundary or accounting system. Review any custom rules and regular expressions supplied by your application; poorly designed expressions can consume excessive CPU.

## License

MIT. See [LICENSE](LICENSE).

## Maintenance and compatibility

Version 0.1.0 is an unpublished initial API. Follow the changelog for incompatible changes; before 1.0, a minor version may change the API. Adding a country module does not make existing modules comprehensive. Maintainers must recheck authoritative sources and relevant amendments before changing statutory claims or releasing jurisdictional rules. See [PUBLISHING.md](PUBLISHING.md) for dated sources, unsupported cases and the release checklist.

Contributions and development commands are in [CONTRIBUTING.md](CONTRIBUTING.md). Report security issues using [SECURITY.md](SECURITY.md). Created by [Brownsmith Dynamics](https://brownsmithdynamics.com). The repository remote configured locally is `https://github.com/apnatvar/plugins.git`; public availability of this uncommitted module has not been verified, so no published package or module-source URL is claimed.

## India GST checks

India GST checks are opt-in custom rules, so use them only for invoices whose context you have established. The library does not determine the legally applicable supply type, tax rate, invoice category, registration obligation, or HSN/SAC digits. It also does not contact the GST Portal. See [PUBLISHING.md](PUBLISHING.md) for source notes, checksum limits, and the scope of these checks.

The India helpers have different levels of assurance:

- `isValidGstinFormat(value)` checks a conventional 15-character, PAN-based GSTIN shape. It does not cover TAN-based assignments or validate a UIN.
- `hasValidGstinChecksum(value)` runs the locally implemented alternating base-36 check over that format. The CGST Rules identify a final checksum character, but the sources reviewed for this package do not specify this arithmetic. Treat it as a technical typo check, not legal certification.
- `isValidGstin(value)` combines those format and checksum checks. None of these functions verifies that the GSTIN exists, is active, belongs to a party, or is appropriate for the invoice.

`createIndiaRules(options)` returns a custom rule array for `validateInvoice`. Defaults leave the optional requirements and consistency checks disabled. If a GSTIN is supplied, the rule always checks its supported shape and local checksum.

| Option | Default | Behavior |
| --- | --- | --- |
| `requireGstin` | `false` | `'supplier'` requires supplier GSTIN; `'both'` requires supplier and customer GSTIN; `false` requires neither. |
| `requirePlaceOfSupply` | `false` | Requires `invoice.india.placeOfSupply` to be present. |
| `requireHsn` | `false` | Requires each line item's `hsn` field to be non-empty. The field can represent HSN/SAC; the library does not check applicable digit length. |
| `requireReverseChargeFlag` | `false` | Requires `invoice.india.reverseCharge` to be explicitly `true` or `false`. |
| `checkSupplyType` | `false` | When supply type is explicitly `intra` or `inter`, checks each GST-taxed line's component labels. Inter-State expects IGST alone. Intra-State expects CGST plus exactly one of SGST or UTGST, with equal rates and amounts. Amount equality uses validator currency precision and rounding. |
| `checkStateConsistency` | `false` | Checks a party's `stateCode` against its supplied GSTIN prefix, validates provided codes, and compares supplier state with `india.placeOfSupply` when both are two-digit codes and supply type is explicit. The intra/inter comparison covers an ordinary domestic case and does not handle statutory exceptions. |
| `allowedStateCodes` | unset | Optional caller-maintained list of valid two-digit state codes. Used only with `checkStateConsistency`; no built-in state registry is embedded. |

Malformed configuration throws `RangeError` when `createIndiaRules` is called. Valid configuration produces a normal `CustomRule[]`; invoice problems appear in the validation result as `india.*` issues: `india.gstin.required`, `india.gstin.format`, `india.gstin.checksum`, `india.state-code.gstin-mismatch`, `india.state-code.format`, `india.state-code.unknown`, `india.place-of-supply.state-code-format`, `india.place-of-supply.unknown-state`, `india.supply-type.state-mismatch`, `india.place-of-supply.required`, `india.reverse-charge.required`, `india.hsn.required`, `india.tax-components.interstate`, `india.tax-components.intrastate`, `india.tax-split.rate`, and `india.tax-split.amount`.

Example with an explicitly recorded ordinary intra-State case:

```js
import { readFile } from 'node:fs/promises';
import { validateInvoice } from '@brownsmithdynamics/invoice-rules';
import { createIndiaRules } from '@brownsmithdynamics/invoice-rules/india';

const invoice = JSON.parse(await readFile(new URL('./india-invoice.json', import.meta.url), 'utf8'));
const result = validateInvoice(invoice, {
  rules: createIndiaRules({
    requirePlaceOfSupply: true,
    requireHsn: true,
    requireReverseChargeFlag: true,
    checkSupplyType: true,
    checkStateConsistency: true,
    allowedStateCodes: ['29'],
  }),
});

console.log(result.valid ? 'Invoice passed configured checks.' : result.issues);
```

The example uses illustrative rates and amounts, not a recommendation for any supply. The fixture is fictional, intentionally has no GSTIN, and uses `DEMO-SAC` only to illustrate the presence check; it does not claim that identifier is a valid HSN/SAC. It does not enable a GSTIN requirement. Run the example from the repository with `node examples/india.mjs` after building the package with `npm run build`; the source fixture is [examples/india-invoice.json](examples/india-invoice.json).
