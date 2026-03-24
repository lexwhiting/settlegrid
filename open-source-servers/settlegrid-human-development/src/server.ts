/**
 * settlegrid-human-development — Human Development Index MCP Server
 *
 * Wraps the UNDP HDR API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_hdi(country, year?)     — Get HDI data (2\u00A2)
 *   list_countries(year?)       — List countries (1\u00A2)
 *   get_rankings(year?)         — Get HDI rankings (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface HdiInput {
  country: string
  year?: string
}

interface ListInput {
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://hdr.undp.org/data-center/api'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-human-development/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`UNDP HDR API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'human-development',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_hdi: { costCents: 2, displayName: 'Get HDI for a country' },
      list_countries: { costCents: 1, displayName: 'List countries with HDI data' },
      get_rankings: { costCents: 2, displayName: 'Get HDI rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getHdi = sg.wrap(async (args: HdiInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO3 country code, e.g. USA)')
  }
  const params: Record<string, string> = {
    indicator_id: '137506',
    country_code: args.country.toUpperCase(),
  }
  if (args.year) params.year = args.year
  return apiFetch<unknown>('/indicator-data', params)
}, { method: 'get_hdi' })

const listCountries = sg.wrap(async (args: ListInput) => {
  return apiFetch<unknown>('/countries')
}, { method: 'list_countries' })

const getRankings = sg.wrap(async (args: ListInput) => {
  const params: Record<string, string> = { indicator_id: '137506' }
  if (args.year) params.year = args.year
  return apiFetch<unknown>('/indicator-data', params)
}, { method: 'get_rankings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getHdi, listCountries, getRankings }

console.log('settlegrid-human-development MCP server ready')
console.log('Methods: get_hdi, list_countries, get_rankings')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
