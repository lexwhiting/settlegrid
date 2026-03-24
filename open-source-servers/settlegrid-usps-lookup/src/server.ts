/**
 * settlegrid-usps-lookup — ZIP Code Lookup MCP Server
 *
 * US and international postal code lookup via Zippopotam.us.
 *
 * Methods:
 *   lookup_zip(zip)               — Get city, state, and coordinates for a US ZIP code  (1¢)
 *   lookup_international(country, code) — Look up postal code in any country (ISO 2-letter code)  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LookupZipInput {
  zip: string
}

interface LookupInternationalInput {
  country: string
  code: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.zippopotam.us'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-usps-lookup/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ZIP Code Lookup API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'usps-lookup',
  pricing: {
    defaultCostCents: 1,
    methods: {
      lookup_zip: { costCents: 1, displayName: 'Lookup ZIP' },
      lookup_international: { costCents: 1, displayName: 'International Lookup' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const lookupZip = sg.wrap(async (args: LookupZipInput) => {
  if (!args.zip || typeof args.zip !== 'string') throw new Error('zip is required')
  const zip = args.zip.trim()
  const data = await apiFetch<any>(`/us/${encodeURIComponent(zip)}`)
  return {
    post code: data.post code,
    country: data.country,
    country abbreviation: data.country abbreviation,
    places: data.places,
  }
}, { method: 'lookup_zip' })

const lookupInternational = sg.wrap(async (args: LookupInternationalInput) => {
  if (!args.country || typeof args.country !== 'string') throw new Error('country is required')
  const country = args.country.trim()
  if (!args.code || typeof args.code !== 'string') throw new Error('code is required')
  const code = args.code.trim()
  const data = await apiFetch<any>(`/${encodeURIComponent(country)}/${encodeURIComponent(code)}`)
  return {
    post code: data.post code,
    country: data.country,
    country abbreviation: data.country abbreviation,
    places: data.places,
  }
}, { method: 'lookup_international' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { lookupZip, lookupInternational }

console.log('settlegrid-usps-lookup MCP server ready')
console.log('Methods: lookup_zip, lookup_international')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
