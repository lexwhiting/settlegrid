/**
 * settlegrid-wipo-patents — WIPO Patent Data MCP Server
 *
 * Wraps the WIPO IP Statistics API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_patent_stats(country, year?)    — Get patent stats (2\u00A2)
 *   list_countries()                    — List countries (1\u00A2)
 *   get_trend(country, indicator)       — Get trend data (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PatentStatsInput {
  country: string
  year?: string
}

interface TrendInput {
  country: string
  indicator: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www3.wipo.int/ipstats/api'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-wipo-patents/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`WIPO API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'wipo-patents',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_patent_stats: { costCents: 2, displayName: 'Get patent statistics for a country' },
      list_countries: { costCents: 1, displayName: 'List countries with patent data' },
      get_trend: { costCents: 2, displayName: 'Get patent trend data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPatentStats = sg.wrap(async (args: PatentStatsInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO2 country code, e.g. US)')
  }
  const params: Record<string, string> = { country: args.country.toUpperCase(), type: 'patent' }
  if (args.year) params.year = args.year
  return apiFetch<unknown>('/ipcountryprofile', params)
}, { method: 'get_patent_stats' })

const listCountries = sg.wrap(async () => {
  return apiFetch<unknown>('/countries')
}, { method: 'list_countries' })

const getTrend = sg.wrap(async (args: TrendInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO2 country code)')
  }
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required (e.g. patent_applications)')
  }
  return apiFetch<unknown>('/trend', {
    country: args.country.toUpperCase(),
    indicator: args.indicator,
  })
}, { method: 'get_trend' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPatentStats, listCountries, getTrend }

console.log('settlegrid-wipo-patents MCP server ready')
console.log('Methods: get_patent_stats, list_countries, get_trend')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
