/**
 * settlegrid-v-dem — Democracy Indices MCP Server
 *
 * Wraps World Bank governance indicators as democracy index proxy.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_index(country, year?)   — Get democracy index (2\u00A2)
 *   list_indicators()           — List governance indicators (1\u00A2)
 *   list_countries()            — List countries (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface IndexInput {
  country: string
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'

const GOV_INDICATORS = [
  { code: 'VA.EST', name: 'Voice and Accountability' },
  { code: 'PV.EST', name: 'Political Stability' },
  { code: 'GE.EST', name: 'Government Effectiveness' },
  { code: 'RQ.EST', name: 'Regulatory Quality' },
  { code: 'RL.EST', name: 'Rule of Law' },
  { code: 'CC.EST', name: 'Control of Corruption' },
]

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '100')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-v-dem/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'v-dem',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_index: { costCents: 2, displayName: 'Get democracy governance index' },
      list_indicators: { costCents: 1, displayName: 'List governance indicators' },
      list_countries: { costCents: 1, displayName: 'List countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIndex = sg.wrap(async (args: IndexInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  // VA.EST = Voice and Accountability (core democracy indicator)
  return apiFetch<unknown>(`/country/${encodeURIComponent(args.country)}/indicator/VA.EST`, params)
}, { method: 'get_index' })

const listIndicators = sg.wrap(async () => {
  return { indicators: GOV_INDICATORS, description: 'World Bank Governance Indicators (democracy proxies)' }
}, { method: 'list_indicators' })

const listCountries = sg.wrap(async () => {
  return apiFetch<unknown>('/country', { per_page: '300' })
}, { method: 'list_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIndex, listIndicators, listCountries }

console.log('settlegrid-v-dem MCP server ready')
console.log('Methods: get_index, list_indicators, list_countries')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
