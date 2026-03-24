/**
 * settlegrid-world-bank-poverty — World Bank Poverty Data MCP Server
 *
 * Wraps the World Bank API (poverty indicators) with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_poverty_rate(country, year?)  — Get poverty rate (2\u00A2)
 *   get_gini(country, year?)          — Get GINI coefficient (2\u00A2)
 *   list_indicators()                 — List poverty indicators (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PovertyInput {
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
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-world-bank-poverty/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`World Bank API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'world-bank-poverty',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_poverty_rate: { costCents: 2, displayName: 'Get poverty headcount ratio' },
      get_gini: { costCents: 2, displayName: 'Get GINI coefficient' },
      list_indicators: { costCents: 1, displayName: 'List poverty indicators' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPovertyRate = sg.wrap(async (args: PovertyInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(`/country/${encodeURIComponent(args.country)}/indicator/SI.POV.DDAY`, params)
}, { method: 'get_poverty_rate' })

const getGini = sg.wrap(async (args: PovertyInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(`/country/${encodeURIComponent(args.country)}/indicator/SI.POV.GINI`, params)
}, { method: 'get_gini' })

const listIndicators = sg.wrap(async () => {
  return {
    indicators: [
      { code: 'SI.POV.DDAY', name: 'Poverty headcount ratio at $2.15/day (%)' },
      { code: 'SI.POV.GINI', name: 'GINI index' },
      { code: 'SI.POV.NAHC', name: 'Poverty headcount ratio at national poverty lines (%)' },
      { code: 'SI.DST.10TH.10', name: 'Income share held by highest 10%' },
      { code: 'SI.DST.FRST.10', name: 'Income share held by lowest 10%' },
      { code: 'NY.GNP.PCAP.CD', name: 'GNI per capita (current US$)' },
    ],
  }
}, { method: 'list_indicators' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPovertyRate, getGini, listIndicators }

console.log('settlegrid-world-bank-poverty MCP server ready')
console.log('Methods: get_poverty_rate, get_gini, list_indicators')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
