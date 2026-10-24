import type { CustomRule, Invoice, ValidationIssue } from './types.js';
import { parseDecimal } from './decimal.js';

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTIN_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Checks the conventional PAN-based 15-character GSTIN shape; does not check registration status. */
export function isValidGstinFormat(value: string): boolean {
  return typeof value === 'string' && GSTIN_PATTERN.test(value);
}

/**
 * Checks the final GSTIN character using the commonly implemented base-36,
 * alternating-factor checksum. The CGST Rules specify that the final position
 * is a checksum character, but do not prescribe this calculation in the rule.
 */
export function hasValidGstinChecksum(value: string): boolean {
  if (!isValidGstinFormat(value)) return false;
  let sum = 0;
  let factor = 2;
  for (let i = value.length - 2; i >= 0; i -= 1) {
    const product = GSTIN_ALPHABET.indexOf(value.charAt(i)) * factor;
    sum += Math.floor(product / 36) + (product % 36);
    factor = factor === 2 ? 1 : 2;
  }
  const check = (36 - (sum % 36)) % 36;
  return GSTIN_ALPHABET.charAt(check) === value.charAt(14);
}

/** Checks GSTIN shape and its locally computed checksum, not live GST registration. */
export function isValidGstin(value: string): boolean {
  return isValidGstinFormat(value) && hasValidGstinChecksum(value);
}

export interface IndiaRuleOptions {
  /** Require GSTIN on the named party or both parties; supplied GSTINs are always checked. */
  requireGstin?: 'supplier' | 'both' | false;
  requirePlaceOfSupply?: boolean;
  requireHsn?: boolean;
  requireReverseChargeFlag?: boolean;
  /** Check GST tax component labels against explicit invoice.india.supplyType. Defaults to false. */
  checkSupplyType?: boolean;
  /** Compare explicit state and place-of-supply codes with the supplier GSTIN/state and supplyType. */
  checkStateConsistency?: boolean;
  /** Optional current state-code allowlist supplied by the caller. */
  allowedStateCodes?: readonly string[];
}

function issue(code: string, path: string, message: string): ValidationIssue {
  return { code: `india.${code}`, path, severity: 'error', message };
}

/** Builds optional India-specific invoice checks. No transaction facts are inferred. */
export function createIndiaRules(options: IndiaRuleOptions = {}): CustomRule[] {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new RangeError('India rule options must be an object.');
  }
  for (const key of ['requirePlaceOfSupply', 'requireHsn', 'requireReverseChargeFlag', 'checkSupplyType', 'checkStateConsistency'] as const) {
    if (options[key] !== undefined && typeof options[key] !== 'boolean') {
      throw new RangeError(`${key} must be a boolean when provided.`);
    }
  }
  if (options.requireGstin !== undefined && options.requireGstin !== false && options.requireGstin !== 'supplier' && options.requireGstin !== 'both') {
    throw new RangeError("requireGstin must be 'supplier', 'both', or false.");
  }
  if (options.allowedStateCodes !== undefined && (!Array.isArray(options.allowedStateCodes) || options.allowedStateCodes.some(code => typeof code !== 'string' || !/^\d{2}$/.test(code)))) {
    throw new RangeError('allowedStateCodes must contain only two-digit state codes.');
  }
  const allowedStateCodes = options.allowedStateCodes ? new Set(options.allowedStateCodes) : undefined;
  return [{
    id: 'india',
    validate(invoice: Readonly<Invoice>, context): readonly ValidationIssue[] {
      const issues: ValidationIssue[] = [];
      const required: readonly ('supplier' | 'customer')[] = options.requireGstin === 'both'
        ? ['supplier', 'customer'] as const
        : options.requireGstin === 'supplier' ? ['supplier'] as const : [];

      for (const partyName of ['supplier', 'customer'] as const) {
        const gstin = invoice[partyName].gstin;
        if (!gstin) {
          if (required.includes(partyName)) {
            issues.push(issue('gstin.required', `${partyName}.gstin`, 'GSTIN is required by the configured India rule.'));
          }
          continue;
        }
        if (!isValidGstinFormat(gstin)) {
          issues.push(issue('gstin.format', `${partyName}.gstin`, 'GSTIN must match the expected 15-character structure.'));
        } else if (!hasValidGstinChecksum(gstin)) {
          issues.push(issue('gstin.checksum', `${partyName}.gstin`, 'GSTIN checksum does not match.'));
        }
      }

      if (options.checkStateConsistency) {
        for (const partyName of ['supplier', 'customer'] as const) {
          const party = invoice[partyName];
          const gstinState = party.gstin && isValidGstinFormat(party.gstin) ? party.gstin.slice(0, 2) : undefined;
          if (party.stateCode && gstinState && party.stateCode !== gstinState) {
            issues.push(issue('state-code.gstin-mismatch', `${partyName}.stateCode`, 'Party stateCode does not match the first two GSTIN characters.'));
          }
          for (const [path, code] of [[`${partyName}.stateCode`, party.stateCode], [`${partyName}.gstin`, gstinState]] as const) {
            if (!code) continue;
            if (!/^\d{2}$/.test(code)) issues.push(issue('state-code.format', path, 'State code must be a two-digit code.'));
            else if (allowedStateCodes && !allowedStateCodes.has(code)) issues.push(issue('state-code.unknown', path, 'State code is not in the configured allowedStateCodes list.'));
          }
        }

        const place = invoice.india?.placeOfSupply;
        const supplierCode = invoice.supplier.stateCode
          ?? (invoice.supplier.gstin && isValidGstinFormat(invoice.supplier.gstin) ? invoice.supplier.gstin.slice(0, 2) : undefined);
        if (place && !/^\d{2}$/.test(place)) {
          issues.push(issue('place-of-supply.state-code-format', 'india.placeOfSupply', 'With checkStateConsistency enabled, placeOfSupply must be a two-digit state code.'));
        } else if (place) {
          if (allowedStateCodes && !allowedStateCodes.has(place)) {
            issues.push(issue('place-of-supply.unknown-state', 'india.placeOfSupply', 'Place-of-supply state code is not in the configured allowedStateCodes list.'));
          }
          if (supplierCode && /^\d{2}$/.test(supplierCode) && (invoice.india?.supplyType === 'intra' || invoice.india?.supplyType === 'inter')) {
            const sameState = supplierCode === place;
            if ((invoice.india.supplyType === 'intra') !== sameState) {
              issues.push(issue('supply-type.state-mismatch', 'india.supplyType', 'Explicit supplyType conflicts with supplier state and the two-digit placeOfSupply code for an ordinary domestic supply.'));
            }
          }
        }
      }

      if (options.requirePlaceOfSupply && !invoice.india?.placeOfSupply) {
        issues.push(issue('place-of-supply.required', 'india.placeOfSupply', 'Place of supply is required by the configured India rule.'));
      }
      if (options.requireReverseChargeFlag && typeof invoice.india?.reverseCharge !== 'boolean') {
        issues.push(issue('reverse-charge.required', 'india.reverseCharge', 'Reverse-charge status must be explicitly recorded as true or false.'));
      }
      if (options.requireHsn) {
        invoice.items.forEach((item, index) => {
          if (!item.hsn?.trim()) issues.push(issue('hsn.required', `items[${index}].hsn`, 'HSN/SAC is required by the configured India rule.'));
        });
      }

      const supplyType = invoice.india?.supplyType;
      if (options.checkSupplyType && (supplyType === 'intra' || supplyType === 'inter')) {
        invoice.items.forEach((item, index) => {
          const taxes = item.taxes ?? [];
          const hasCgst = taxes.some(tax => tax.code.toUpperCase() === 'CGST');
          const hasSgst = taxes.some(tax => tax.code.toUpperCase() === 'SGST');
          const hasUtgst = taxes.some(tax => tax.code.toUpperCase() === 'UTGST');
          const hasIgst = taxes.some(tax => tax.code.toUpperCase() === 'IGST');
          const anyGst = hasCgst || hasSgst || hasUtgst || hasIgst;
          if (!anyGst) return;
          const path = `items[${index}].taxes`;

          if (supplyType === 'inter') {
            if (!hasIgst || hasCgst || hasSgst || hasUtgst) {
              issues.push(issue('tax-components.interstate', path, 'Inter-State supply should use IGST without CGST, SGST, or UTGST.'));
            }
            return;
          }

          const stateTaxCount = Number(hasSgst) + Number(hasUtgst);
          if (hasIgst || !hasCgst || stateTaxCount !== 1) {
            issues.push(issue('tax-components.intrastate', path, 'Intra-State supply should use CGST with exactly one of SGST or UTGST, without IGST.'));
            return;
          }
          const stateTax = taxes.find(tax => ['SGST', 'UTGST'].includes(tax.code.toUpperCase()));
          const centralTax = taxes.find(tax => tax.code.toUpperCase() === 'CGST');
          if (stateTax && centralTax && parseDecimal(stateTax.rate) !== parseDecimal(centralTax.rate)) {
            issues.push(issue('tax-split.rate', path, 'CGST and the corresponding SGST/UTGST rates should be equal for this ordinary intra-State case.'));
          }
          if (stateTax && centralTax && !context.equalAmounts(stateTax.amount, centralTax.amount)) {
            issues.push(issue('tax-split.amount', path, 'CGST and the corresponding SGST/UTGST amounts should be equal for this ordinary intra-State case.'));
          }
        });
      }
      return issues;
    },
  }];
}
