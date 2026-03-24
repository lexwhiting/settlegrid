/**
 * settlegrid-statsbureau — StatBureau Global Statistics MCP Server
 *
 * Wraps the StatBureau API with SettleGrid billing.
 * Requires STATBUREAU_API_KEY environment variable.
 *
 * Methods:
 *   get_inflation(country)   — Inflation data      (2¢)
 *   get_cpi(country)         — CPI data            (2¢)
 *   get_countries()          — List countries       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CountryInput { country: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.statbureau.org/api/v1'

function getKey(): string {
  const k = process.env.STATBUREAU_API_KEY
  if (!k) throw new Error('STATBUREAU_API_KEY environment variable is required')
  return k
}

async function sbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('api_key', getKey())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-statsbureau/1.0 (contact@settlegrid.ai)', Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`StatBureau API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'statsbureau',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_inflation: { costCents: 2, displayName: 'Inflation Data' },
      get_cpi: { costCents: 2, displayName: 'CPI Data' },
      get_countries: { costCents: 1, displayName: 'List Countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getInflation = sg.wrap(async (args: CountryInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (e.g. "united-states")')
  }
  const data = await sbFetch<Array<Record<string, unknown>>>('/inflation', {
    country: args.country.toLowerCase().trim(),
  })
  return { country: args.country, count: Array.isArray(data) ? data.length : 0, data: Array.isArray(data) ? data : [data] }
}, { method: 'get_inflation' })

const getCpi = sg.wrap(async (args: CountryInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (e.g. "united-states")')
  }
  const data = await sbFetch<Array<Record<string, unknown>>>('/cpi', {
    country: args.country.toLowerCase().trim(),
  })
  return { country: args.country, count: Array.isArray(data) ? data.length : 0, data: Array.isArray(data) ? data : [data] }
}, { method: 'get_cpi' })

const getCountries = sg.wrap(async () => {
  const data = await sbFetch<Array<Record<string, unknown>>>('/countries')
  return { count: Array.isArray(data) ? data.length : 0, countries: data }
}, { method: 'get_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getInflation, getCpi, getCountries }

console.log('settlegrid-statsbureau MCP server ready')
console.log('Methods: get_inflation, get_cpi, get_countries')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
