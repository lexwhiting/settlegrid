/**
 * settlegrid-imf-weo — IMF World Economic Outlook MCP Server
 *
 * Wraps the IMF DataMapper API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_indicator(indicator, country?)  — Get WEO data (2\u00A2)
 *   list_indicators()                   — List indicators (1\u00A2)
 *   list_countries()                    — List countries (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetIndicatorInput {
  indicator: string
  country?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.imf.org/external/datamapper/api/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-imf-weo/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`IMF API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'imf-weo',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_indicator: { costCents: 2, displayName: 'Get WEO indicator data' },
      list_indicators: { costCents: 1, displayName: 'List WEO indicators' },
      list_countries: { costCents: 1, displayName: 'List available countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIndicator = sg.wrap(async (args: GetIndicatorInput) => {
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required (e.g. NGDP_RPCH for GDP growth)')
  }
  const path = args.country
    ? `/${encodeURIComponent(args.indicator)}/${encodeURIComponent(args.country.toUpperCase())}`
    : `/${encodeURIComponent(args.indicator)}`
  return apiFetch<unknown>(path)
}, { method: 'get_indicator' })

const listIndicators = sg.wrap(async () => {
  return apiFetch<unknown>('/indicators')
}, { method: 'list_indicators' })

const listCountries = sg.wrap(async () => {
  return apiFetch<unknown>('/countries')
}, { method: 'list_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIndicator, listIndicators, listCountries }

console.log('settlegrid-imf-weo MCP server ready')
console.log('Methods: get_indicator, list_indicators, list_countries')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
