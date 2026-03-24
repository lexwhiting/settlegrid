/**
 * settlegrid-itu-telecom — ITU Telecom Data MCP Server
 *
 * Wraps the ITU DataHub API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_indicator(indicator, country?)  — Get indicator data (2\u00A2)
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

const API_BASE = 'https://datahub.itu.int/api'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-itu-telecom/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ITU API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'itu-telecom',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_indicator: { costCents: 2, displayName: 'Get telecom indicator data' },
      list_indicators: { costCents: 1, displayName: 'List available indicators' },
      list_countries: { costCents: 1, displayName: 'List available countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIndicator = sg.wrap(async (args: GetIndicatorInput) => {
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required')
  }
  const params: Record<string, string> = { indicator: args.indicator }
  if (args.country) params.country = args.country.toUpperCase()
  return apiFetch<unknown>('/data', params)
}, { method: 'get_indicator' })

const listIndicators = sg.wrap(async () => {
  return apiFetch<unknown>('/indicators')
}, { method: 'list_indicators' })

const listCountries = sg.wrap(async () => {
  return apiFetch<unknown>('/countries')
}, { method: 'list_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIndicator, listIndicators, listCountries }

console.log('settlegrid-itu-telecom MCP server ready')
console.log('Methods: get_indicator, list_indicators, list_countries')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
