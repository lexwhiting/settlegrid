/**
 * settlegrid-phone-validate — Phone Validator MCP Server
 *
 * Validate and lookup phone numbers via Abstract API.
 *
 * Methods:
 *   validate(phone)               — Validate a phone number  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ValidateInput {
  phone: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://phonevalidation.abstractapi.com/v1'
const API_KEY = process.env.ABSTRACT_PHONE_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-phone-validate/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Phone Validator API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'phone-validate',
  pricing: {
    defaultCostCents: 2,
    methods: {
      validate: { costCents: 2, displayName: 'Validate Phone' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const validate = sg.wrap(async (args: ValidateInput) => {
  if (!args.phone || typeof args.phone !== 'string') throw new Error('phone is required')
  const phone = args.phone.trim()
  const data = await apiFetch<any>(`/?phone=${encodeURIComponent(phone)}&api_key=${API_KEY}`)
  return {
    phone: data.phone,
    valid: data.valid,
    country: data.country,
    carrier: data.carrier,
    type: data.type,
    location: data.location,
  }
}, { method: 'validate' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { validate }

console.log('settlegrid-phone-validate MCP server ready')
console.log('Methods: validate')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
