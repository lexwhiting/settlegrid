/**
 * settlegrid-world-bank-climate — World Bank Climate Data MCP Server
 *
 * Wraps the World Bank API (climate indicators) with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_climate_data(country, indicator)  — Get climate data (2\u00A2)
 *   list_indicators()                     — List climate indicators (1\u00A2)
 *   get_historical(country, variable)     — Get historical data (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ClimateDataInput {
  country: string
  indicator: string
}

interface HistoricalInput {
  country: string
  variable: string
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
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-world-bank-climate/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`World Bank API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const CLIMATE_INDICATORS = [
  'EN.ATM.CO2E.PC', 'EN.ATM.CO2E.KT', 'EG.FEC.RNEW.ZS', 'AG.LND.FRST.ZS',
  'EN.ATM.GHGT.KT.CE', 'EG.USE.PCAP.KG.OE', 'EN.ATM.PM25.MC.M3',
]

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'world-bank-climate',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_climate_data: { costCents: 2, displayName: 'Get climate indicator data' },
      list_indicators: { costCents: 1, displayName: 'List climate indicators' },
      get_historical: { costCents: 2, displayName: 'Get historical climate data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getClimateData = sg.wrap(async (args: ClimateDataInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required (e.g. EN.ATM.CO2E.PC)')
  }
  return apiFetch<unknown>(`/country/${encodeURIComponent(args.country)}/indicator/${encodeURIComponent(args.indicator)}`)
}, { method: 'get_climate_data' })

const listIndicators = sg.wrap(async () => {
  return {
    indicators: CLIMATE_INDICATORS.map(code => ({ code, url: `${API_BASE}/indicator/${code}?format=json` })),
    description: 'Climate-related World Bank indicators',
  }
}, { method: 'list_indicators' })

const getHistorical = sg.wrap(async (args: HistoricalInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required')
  }
  if (!args.variable || typeof args.variable !== 'string') {
    throw new Error('variable is required (WB indicator code)')
  }
  return apiFetch<unknown>(`/country/${encodeURIComponent(args.country)}/indicator/${encodeURIComponent(args.variable)}`, {
    date: '1960:2025',
  })
}, { method: 'get_historical' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getClimateData, listIndicators, getHistorical }

console.log('settlegrid-world-bank-climate MCP server ready')
console.log('Methods: get_climate_data, list_indicators, get_historical')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
