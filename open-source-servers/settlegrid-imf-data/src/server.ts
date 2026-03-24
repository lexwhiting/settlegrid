/**
 * settlegrid-imf-data — IMF Economic Data MCP Server
 *
 * Wraps the IMF DataMapper API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_indicators()                       — List indicators   (1¢)
 *   get_indicator_data(indicator, country?) — Indicator data    (1¢)
 *   get_countries()                        — List countries    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface IndicatorInput { indicator: string; country?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.imf.org/external/datamapper/api/v1'
const UA = 'settlegrid-imf-data/1.0 (contact@settlegrid.ai)'

async function imfFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`IMF API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'imf-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_indicators: { costCents: 1, displayName: 'List Indicators' },
      get_indicator_data: { costCents: 1, displayName: 'Indicator Data' },
      get_countries: { costCents: 1, displayName: 'List Countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIndicators = sg.wrap(async () => {
  const data = await imfFetch<Record<string, unknown>>('/indicators')
  return data
}, { method: 'get_indicators' })

const getIndicatorData = sg.wrap(async (args: IndicatorInput) => {
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required (e.g. "NGDP_RPCH")')
  }
  const path = args.country
    ? `/${encodeURIComponent(args.indicator)}/${encodeURIComponent(args.country.toUpperCase().trim())}`
    : `/${encodeURIComponent(args.indicator)}`
  const data = await imfFetch<Record<string, unknown>>(path)
  return data
}, { method: 'get_indicator_data' })

const getCountries = sg.wrap(async () => {
  const data = await imfFetch<Record<string, unknown>>('/countries')
  return data
}, { method: 'get_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIndicators, getIndicatorData, getCountries }

console.log('settlegrid-imf-data MCP server ready')
console.log('Methods: get_indicators, get_indicator_data, get_countries')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
