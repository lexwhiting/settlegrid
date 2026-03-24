/**
 * settlegrid-world-bank-health — World Bank Health Data MCP Server
 *
 * Wraps the World Bank API (health indicators) with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_life_expectancy(country, year?)   — Get life expectancy (2\u00A2)
 *   get_health_spending(country, year?)   — Get health spending (2\u00A2)
 *   list_indicators()                     — List health indicators (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface HealthDataInput {
  country: string
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '100')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-world-bank-health/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`World Bank API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'world-bank-health',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_life_expectancy: { costCents: 2, displayName: 'Get life expectancy data' },
      get_health_spending: { costCents: 2, displayName: 'Get health expenditure data' },
      list_indicators: { costCents: 1, displayName: 'List health indicators' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLifeExpectancy = sg.wrap(async (args: HealthDataInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(`/country/${encodeURIComponent(args.country)}/indicator/SP.DYN.LE00.IN`, params)
}, { method: 'get_life_expectancy' })

const getHealthSpending = sg.wrap(async (args: HealthDataInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(`/country/${encodeURIComponent(args.country)}/indicator/SH.XPD.CHEX.GD.ZS`, params)
}, { method: 'get_health_spending' })

const listIndicators = sg.wrap(async () => {
  return {
    indicators: [
      { code: 'SP.DYN.LE00.IN', name: 'Life expectancy at birth' },
      { code: 'SH.XPD.CHEX.GD.ZS', name: 'Current health expenditure (% GDP)' },
      { code: 'SP.DYN.IMRT.IN', name: 'Infant mortality rate' },
      { code: 'SH.MED.PHYS.ZS', name: 'Physicians per 1,000 people' },
      { code: 'SH.MED.BEDS.ZS', name: 'Hospital beds per 1,000 people' },
      { code: 'SH.STA.MMRT', name: 'Maternal mortality ratio' },
    ],
  }
}, { method: 'list_indicators' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLifeExpectancy, getHealthSpending, listIndicators }

console.log('settlegrid-world-bank-health MCP server ready')
console.log('Methods: get_life_expectancy, get_health_spending, list_indicators')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
