/**
 * settlegrid-gender-gap — Gender Gap Index MCP Server
 *
 * Wraps World Bank gender parity indicators as gender gap proxy.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_score(country, year?)     — Get gender parity score (2\u00A2)
 *   list_countries(year?)         — List countries (1\u00A2)
 *   get_rankings(year?)           — Get gender parity rankings (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScoreInput {
  country: string
  year?: string
}

interface ListInput {
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'
const INDICATOR = 'SG.GEN.PARL.ZS' // Proportion of seats held by women in parliament

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '300')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-gender-gap/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'gender-gap',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_score: { costCents: 2, displayName: 'Get gender parity score' },
      list_countries: { costCents: 1, displayName: 'List countries' },
      get_rankings: { costCents: 2, displayName: 'Get gender parity rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScore = sg.wrap(async (args: ScoreInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(`/country/${encodeURIComponent(args.country)}/indicator/${INDICATOR}`, params)
}, { method: 'get_score' })

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

export { getScore, listCountries, getRankings }

console.log('settlegrid-gender-gap MCP server ready')
console.log('Methods: get_score, list_countries, get_rankings')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
