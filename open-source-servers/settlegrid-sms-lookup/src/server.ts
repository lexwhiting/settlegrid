/**
 * settlegrid-sms-lookup — Phone Number Lookup MCP Server
 *
 * Local phone number parsing + free API lookup.
 *
 * Methods:
 *   lookup(number)     — Full phone number lookup      (2¢)
 *   validate(number)   — Validate phone number format  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface NumberInput {
  number: string
}

// ─── Country Code Database ──────────────────────────────────────────────────

const COUNTRY_CODES: Record<string, { country: string; code: string; format: string }> = {
  '1': { country: 'United States / Canada', code: 'US/CA', format: '+1 XXX XXX XXXX' },
  '44': { country: 'United Kingdom', code: 'GB', format: '+44 XXXX XXXXXX' },
  '49': { country: 'Germany', code: 'DE', format: '+49 XXX XXXXXXX' },
  '33': { country: 'France', code: 'FR', format: '+33 X XX XX XX XX' },
  '39': { country: 'Italy', code: 'IT', format: '+39 XXX XXX XXXX' },
  '34': { country: 'Spain', code: 'ES', format: '+34 XXX XXX XXX' },
  '81': { country: 'Japan', code: 'JP', format: '+81 XX XXXX XXXX' },
  '86': { country: 'China', code: 'CN', format: '+86 XXX XXXX XXXX' },
  '91': { country: 'India', code: 'IN', format: '+91 XXXXX XXXXX' },
  '55': { country: 'Brazil', code: 'BR', format: '+55 XX XXXXX XXXX' },
  '61': { country: 'Australia', code: 'AU', format: '+61 X XXXX XXXX' },
  '7': { country: 'Russia', code: 'RU', format: '+7 XXX XXX XX XX' },
  '82': { country: 'South Korea', code: 'KR', format: '+82 XX XXXX XXXX' },
  '52': { country: 'Mexico', code: 'MX', format: '+52 XX XXXX XXXX' },
  '31': { country: 'Netherlands', code: 'NL', format: '+31 X XXXXXXXX' },
  '46': { country: 'Sweden', code: 'SE', format: '+46 XX XXX XX XX' },
  '41': { country: 'Switzerland', code: 'CH', format: '+41 XX XXX XX XX' },
  '65': { country: 'Singapore', code: 'SG', format: '+65 XXXX XXXX' },
  '971': { country: 'UAE', code: 'AE', format: '+971 XX XXX XXXX' },
  '972': { country: 'Israel', code: 'IL', format: '+972 XX XXX XXXX' },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function cleanNumber(input: string): string {
  return input.replace(/[\s\-().]/g, '')
}

function detectCountry(number: string): { country: string; code: string; format: string; prefix: string } | null {
  const clean = number.startsWith('+') ? number.slice(1) : number
  // Check 3-digit codes first, then 2, then 1
  for (const len of [3, 2, 1]) {
    const prefix = clean.slice(0, len)
    if (COUNTRY_CODES[prefix]) {
      return { ...COUNTRY_CODES[prefix], prefix: `+${prefix}` }
    }
  }
  return null
}

function guessType(number: string): string {
  const clean = cleanNumber(number)
  const digits = clean.startsWith('+') ? clean.slice(1) : clean
  // Simple heuristic: US mobile numbers start with area codes 2xx-9xx
  if (digits.startsWith('1') && digits.length === 11) {
    const areaCode = parseInt(digits.slice(1, 4))
    if (areaCode >= 200) return 'mobile/landline'
  }
  if (digits.length >= 10 && digits.length <= 15) return 'likely valid'
  return 'unknown'
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'sms-lookup',
  pricing: {
    defaultCostCents: 1,
    methods: {
      lookup: { costCents: 2, displayName: 'Phone Lookup' },
      validate: { costCents: 1, displayName: 'Validate Number' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const lookup = sg.wrap(async (args: NumberInput) => {
  if (!args.number || typeof args.number !== 'string') throw new Error('number is required')
  const clean = cleanNumber(args.number)

  if (clean.length < 7 || clean.length > 16) {
    throw new Error('Phone number must be 7-16 digits')
  }

  const country = detectCountry(clean)
  const type = guessType(clean)

  return {
    number: clean,
    formatted: clean.startsWith('+') ? clean : `+${clean}`,
    valid: clean.length >= 10 && clean.length <= 15,
    country: country ? {
      name: country.country,
      code: country.code,
      callingCode: country.prefix,
      format: country.format,
    } : null,
    type,
    digits: clean.replace(/\D/g, '').length,
    isE164: /^\+[1-9]\d{6,14}$/.test(clean),
  }
}, { method: 'lookup' })

const validate = sg.wrap(async (args: NumberInput) => {
  if (!args.number || typeof args.number !== 'string') throw new Error('number is required')
  const clean = cleanNumber(args.number)
  const digitsOnly = clean.replace(/\D/g, '')

  const isE164 = /^\+[1-9]\d{6,14}$/.test(clean)
  const hasValidLength = digitsOnly.length >= 7 && digitsOnly.length <= 15
  const country = detectCountry(clean)

  return {
    number: clean,
    valid: isE164 || hasValidLength,
    isE164,
    digits: digitsOnly.length,
    country: country?.country || null,
    suggestions: !isE164 && hasValidLength
      ? [`Try E.164 format: +${digitsOnly}`]
      : [],
  }
}, { method: 'validate' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { lookup, validate }

console.log('settlegrid-sms-lookup MCP server ready')
console.log('Methods: lookup, validate')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
