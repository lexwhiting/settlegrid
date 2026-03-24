/**
 * settlegrid-who-data — WHO Data MCP Server
 *
 * World Health Organization health indicators and statistics.
 *
 * Methods:
 *   list_indicators(query)        — List available WHO health indicators  (1¢)
 *   get_indicator_data(indicator_code, country) — Get data for a specific WHO indicator by country  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListIndicatorsInput {
  query?: string
}

interface GetIndicatorDataInput {
  indicator_code: string
  country?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://ghoapi.azureedge.net/api'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-who-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`WHO Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'who-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_indicators: { costCents: 1, displayName: 'List Indicators' },
      get_indicator_data: { costCents: 1, displayName: 'Get Indicator Data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listIndicators = sg.wrap(async (args: ListIndicatorsInput) => {
  const query = typeof args.query === 'string' ? args.query.trim() : ''
  const data = await apiFetch<any>(`/Indicator?$filter=contains(IndicatorName,'${encodeURIComponent(query)}')`)
  const items = (data.value ?? []).slice(0, 15)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        IndicatorCode: item.IndicatorCode,
        IndicatorName: item.IndicatorName,
    })),
  }
}, { method: 'list_indicators' })

const getIndicatorData = sg.wrap(async (args: GetIndicatorDataInput) => {
  if (!args.indicator_code || typeof args.indicator_code !== 'string') throw new Error('indicator_code is required')
  const indicator_code = args.indicator_code.trim()
  const country = typeof args.country === 'string' ? args.country.trim() : ''
  const data = await apiFetch<any>(`/${encodeURIComponent(indicator_code)}?$filter=SpatialDim eq '${encodeURIComponent(country)}'`)
  const items = (data.value ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        SpatialDim: item.SpatialDim,
        TimeDim: item.TimeDim,
        NumericValue: item.NumericValue,
        Value: item.Value,
    })),
  }
}, { method: 'get_indicator_data' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listIndicators, getIndicatorData }

console.log('settlegrid-who-data MCP server ready')
console.log('Methods: list_indicators, get_indicator_data')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
