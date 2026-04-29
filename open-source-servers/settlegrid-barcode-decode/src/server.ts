/**
 * settlegrid-barcode-decode — Barcode Identification & Validation MCP Server
 *
 * Identifies barcode formats, validates EAN/UPC check digits, and decodes
 * country prefixes. All logic implemented locally.
 *
 * Methods:
 *   identify_format(code)         — Identify barcode type           (1¢)
 *   validate_ean(ean)             — Validate EAN/UPC check digit    (1¢)
 *   lookup_prefix(code)           — Lookup GS1 country prefix       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface IdentifyFormatInput {
  code: string
}

interface ValidateEanInput {
  ean: string
}

interface LookupPrefixInput {
  code: string
}

// ─── Data ───────────────────────────────────────────────────────────────────

const GS1_PREFIXES: Array<{ range_start: string; range_end: string; country: string }> = [
  { range_start: '000', range_end: '019', country: 'United States / Canada' },
  { range_start: '020', range_end: '029', country: 'Restricted distribution' },
  { range_start: '030', range_end: '039', country: 'United States' },
  { range_start: '040', range_end: '049', country: 'Restricted distribution' },
  { range_start: '050', range_end: '059', country: 'Coupons' },
  { range_start: '060', range_end: '099', country: 'United States / Canada' },
  { range_start: '100', range_end: '139', country: 'United States' },
  { range_start: '300', range_end: '379', country: 'France' },
  { range_start: '380', range_end: '380', country: 'Bulgaria' },
  { range_start: '383', range_end: '383', country: 'Slovenia' },
  { range_start: '385', range_end: '385', country: 'Croatia' },
  { range_start: '400', range_end: '440', country: 'Germany' },
  { range_start: '450', range_end: '459', country: 'Japan' },
  { range_start: '460', range_end: '469', country: 'Russia' },
  { range_start: '471', range_end: '471', country: 'Taiwan' },
  { range_start: '474', range_end: '474', country: 'Estonia' },
  { range_start: '475', range_end: '475', country: 'Latvia' },
  { range_start: '476', range_end: '476', country: 'Azerbaijan' },
  { range_start: '480', range_end: '480', country: 'Philippines' },
  { range_start: '489', range_end: '489', country: 'Hong Kong' },
  { range_start: '500', range_end: '509', country: 'United Kingdom' },
  { range_start: '520', range_end: '521', country: 'Greece' },
  { range_start: '528', range_end: '528', country: 'Lebanon' },
  { range_start: '529', range_end: '529', country: 'Cyprus' },
  { range_start: '531', range_end: '531', country: 'North Macedonia' },
  { range_start: '535', range_end: '535', country: 'Malta' },
  { range_start: '539', range_end: '539', country: 'Ireland' },
  { range_start: '540', range_end: '549', country: 'Belgium / Luxembourg' },
  { range_start: '560', range_end: '560', country: 'Portugal' },
  { range_start: '569', range_end: '569', country: 'Iceland' },
  { range_start: '570', range_end: '579', country: 'Denmark' },
  { range_start: '590', range_end: '590', country: 'Poland' },
  { range_start: '599', range_end: '599', country: 'Hungary' },
  { range_start: '600', range_end: '601', country: 'South Africa' },
  { range_start: '609', range_end: '609', country: 'Mauritius' },
  { range_start: '611', range_end: '611', country: 'Morocco' },
  { range_start: '613', range_end: '613', country: 'Algeria' },
  { range_start: '616', range_end: '616', country: 'Kenya' },
  { range_start: '618', range_end: '618', country: 'Ivory Coast' },
  { range_start: '619', range_end: '619', country: 'Tunisia' },
  { range_start: '621', range_end: '621', country: 'Syria' },
  { range_start: '622', range_end: '622', country: 'Egypt' },
  { range_start: '624', range_end: '624', country: 'Libya' },
  { range_start: '625', range_end: '625', country: 'Jordan' },
  { range_start: '626', range_end: '626', country: 'Iran' },
  { range_start: '628', range_end: '628', country: 'Saudi Arabia' },
  { range_start: '629', range_end: '629', country: 'UAE' },
  { range_start: '640', range_end: '649', country: 'Finland' },
  { range_start: '690', range_end: '695', country: 'China' },
  { range_start: '700', range_end: '709', country: 'Norway' },
  { range_start: '729', range_end: '729', country: 'Israel' },
  { range_start: '730', range_end: '739', country: 'Sweden' },
  { range_start: '740', range_end: '740', country: 'Guatemala' },
  { range_start: '741', range_end: '741', country: 'El Salvador' },
  { range_start: '742', range_end: '742', country: 'Honduras' },
  { range_start: '743', range_end: '743', country: 'Nicaragua' },
  { range_start: '744', range_end: '744', country: 'Costa Rica' },
  { range_start: '745', range_end: '745', country: 'Panama' },
  { range_start: '750', range_end: '750', country: 'Mexico' },
  { range_start: '754', range_end: '755', country: 'Canada' },
  { range_start: '759', range_end: '759', country: 'Venezuela' },
  { range_start: '760', range_end: '769', country: 'Switzerland' },
  { range_start: '770', range_end: '771', country: 'Colombia' },
  { range_start: '773', range_end: '773', country: 'Uruguay' },
  { range_start: '775', range_end: '775', country: 'Peru' },
  { range_start: '777', range_end: '777', country: 'Bolivia' },
  { range_start: '779', range_end: '779', country: 'Argentina' },
  { range_start: '780', range_end: '780', country: 'Chile' },
  { range_start: '784', range_end: '784', country: 'Paraguay' },
  { range_start: '786', range_end: '786', country: 'Ecuador' },
  { range_start: '789', range_end: '790', country: 'Brazil' },
  { range_start: '800', range_end: '839', country: 'Italy' },
  { range_start: '840', range_end: '849', country: 'Spain' },
  { range_start: '850', range_end: '850', country: 'Cuba' },
  { range_start: '858', range_end: '858', country: 'Slovakia' },
  { range_start: '859', range_end: '859', country: 'Czech Republic' },
  { range_start: '860', range_end: '860', country: 'Serbia' },
  { range_start: '865', range_end: '865', country: 'Mongolia' },
  { range_start: '867', range_end: '867', country: 'North Korea' },
  { range_start: '868', range_end: '869', country: 'Turkey' },
  { range_start: '870', range_end: '879', country: 'Netherlands' },
  { range_start: '880', range_end: '880', country: 'South Korea' },
  { range_start: '884', range_end: '884', country: 'Cambodia' },
  { range_start: '885', range_end: '885', country: 'Thailand' },
  { range_start: '888', range_end: '888', country: 'Singapore' },
  { range_start: '890', range_end: '890', country: 'India' },
  { range_start: '893', range_end: '893', country: 'Vietnam' },
  { range_start: '896', range_end: '896', country: 'Pakistan' },
  { range_start: '899', range_end: '899', country: 'Indonesia' },
  { range_start: '900', range_end: '919', country: 'Austria' },
  { range_start: '930', range_end: '939', country: 'Australia' },
  { range_start: '940', range_end: '949', country: 'New Zealand' },
  { range_start: '955', range_end: '955', country: 'Malaysia' },
  { range_start: '958', range_end: '958', country: 'Macau' },
  { range_start: '978', range_end: '979', country: 'ISBN (Bookland)' },
]

function lookupCountry(code: string): string {
  const prefix3 = code.slice(0, 3)
  for (const entry of GS1_PREFIXES) {
    if (prefix3 >= entry.range_start && prefix3 <= entry.range_end) {
      return entry.country
    }
  }
  return 'Unknown'
}

function calculateCheckDigit(digits: number[], length: number): number {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    sum += digits[i] * (length === 13 ? (i % 2 === 0 ? 1 : 3) : (i % 2 === 0 ? 3 : 1))
  }
  return (10 - (sum % 10)) % 10
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'barcode-decode',
  pricing: {
    defaultCostCents: 1,
    methods: {
      identify_format: { costCents: 1, displayName: 'Identify Barcode Format' },
      validate_ean: { costCents: 1, displayName: 'Validate EAN/UPC' },
      lookup_prefix: { costCents: 1, displayName: 'Lookup GS1 Prefix' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const identifyFormat = sg.wrap(async (args: IdentifyFormatInput) => {
  if (!args.code || typeof args.code !== 'string') {
    throw new Error('code is required')
  }
  const c = args.code.replace(/[- ]/g, '')
  let format = 'unknown'
  let valid = false
  let description = ''

  if (/^\d{13}$/.test(c)) { format = 'EAN-13'; valid = true; description = 'European Article Number (13 digits)' }
  else if (/^\d{12}$/.test(c)) { format = 'UPC-A'; valid = true; description = 'Universal Product Code (12 digits)' }
  else if (/^\d{8}$/.test(c)) { format = 'EAN-8'; valid = true; description = 'European Article Number (8 digits, small items)' }
  else if (/^978\d{10}$/.test(c) || /^979\d{10}$/.test(c)) { format = 'ISBN-13'; valid = true; description = 'International Standard Book Number' }
  else if (/^\d{14}$/.test(c)) { format = 'GTIN-14'; valid = true; description = 'Global Trade Item Number (logistics)' }
  else if (/^[0-9]{10}$/.test(c)) { format = 'ISBN-10 (likely)'; valid = true; description = 'Legacy ISBN format' }
  else if (/^[A-Z0-9]+$/.test(c) && c.length <= 48) { format = 'Code 128 (likely)'; valid = true; description = 'High-density alphanumeric barcode' }

  const country = (format === 'EAN-13' || format === 'ISBN-13') ? lookupCountry(c) : undefined

  return { code: args.code, normalized: c, format, valid, length: c.length, country: country ?? null, description }
}, { method: 'identify_format' })

const validateEan = sg.wrap(async (args: ValidateEanInput) => {
  if (!args.ean || typeof args.ean !== 'string') {
    throw new Error('ean is required (8 or 13 digits)')
  }
  const c = args.ean.replace(/[- ]/g, '')
  if (!/^\d{8}$|^\d{13}$/.test(c)) {
    throw new Error('Must be 8 or 13 digits')
  }

  const digits = c.split('').map(Number)
  const checkDigit = digits.pop()!
  const expected = calculateCheckDigit(digits, c.length === 13 ? 13 : 8)

  return {
    ean: args.ean,
    valid: checkDigit === expected,
    check_digit: checkDigit,
    expected_check_digit: expected,
    format: c.length === 13 ? 'EAN-13' : 'EAN-8',
    country: c.length === 13 ? lookupCountry(c) : null,
  }
}, { method: 'validate_ean' })

const lookupPrefixFn = sg.wrap(async (args: LookupPrefixInput) => {
  if (!args.code || typeof args.code !== 'string') {
    throw new Error('code is required (barcode digits)')
  }
  const c = args.code.replace(/[- ]/g, '')
  if (c.length < 3) {
    throw new Error('Need at least 3 digits to identify prefix')
  }
  const country = lookupCountry(c)
  return { code: args.code, prefix: c.slice(0, 3), country, found: country !== 'Unknown' }
}, { method: 'lookup_prefix' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { identifyFormat, validateEan, lookupPrefixFn as lookupPrefix }

console.log('settlegrid-barcode-decode MCP server ready')
console.log('Methods: identify_format, validate_ean, lookup_prefix')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
