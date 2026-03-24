/**
 * settlegrid-transparency-intl — Corruption Perceptions Index MCP Server
 *
 * Wraps World Bank Control of Corruption indicator (CC.EST) as CPI proxy.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_cpi(country, year?)       — Get corruption score (2\u00A2)
 *   list_countries(year?)         — List countries (1\u00A2)
 *   get_rankings(year?)           — Get rankings (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CpiInput {
  country: string
  year?: string
}

interface ListInput {
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'
const INDICATOR = 'CC.EST' // Control of Corruption Estimate

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '300')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-transparency-intl/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'transparency-intl',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_cpi: { costCents: 2, displayName: 'Get corruption control score' },
      list_countries: { costCents: 1, displayName: 'List countries' },
      get_rankings: { costCents: 2, displayName: 'Get corruption rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCpi = sg.wrap(async (args: CpiInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(`/country/${encodeURIComponent(args.country)}/indicator/${INDICATOR}`, params)
}, { method: 'get_cpi' })

const listCountries = sg.wrap(async (args: ListInput) => {
  return apiFetch<unknown>('/country', { per_page: '300' })
}, { method: 'list_countries' })

const getRankings = sg.wrap(async (args: ListInput) => {
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  else params.mrnev = '1'
  return apiFetch<unknown>(`/country/all/indicator/${INDICATOR}`, params)
}, { method: 'get_rankings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCpi, listCountries, getRankings }

console.log('settlegrid-transparency-intl MCP server ready')
console.log('Methods: get_cpi, list_countries, get_rankings')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
