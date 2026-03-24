/**
 * settlegrid-fhfa — FHFA Housing Price Index MCP Server
 *
 * Housing price index data via the FRED API (Federal Reserve).
 *
 * Methods:
 *   get_hpi(series_id)            — Get FHFA House Price Index series observations  (1¢)
 *   search_series(query)          — Search FRED for housing price series  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetHpiInput {
  series_id?: string
}

interface SearchSeriesInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.stlouisfed.org/fred'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-fhfa/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FHFA Housing Price Index API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fhfa',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_hpi: { costCents: 1, displayName: 'Get HPI' },
      search_series: { costCents: 1, displayName: 'Search Series' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getHpi = sg.wrap(async (args: GetHpiInput) => {
  const series_id = typeof args.series_id === 'string' ? args.series_id.trim() : ''
  const data = await apiFetch<any>(`/series/observations?series_id=${series_id || "USSTHPI"}&file_type=json&sort_order=desc&limit=20`)
  const items = (data.observations ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        date: item.date,
        value: item.value,
    })),
  }
}, { method: 'get_hpi' })

const searchSeries = sg.wrap(async (args: SearchSeriesInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/series/search?search_text=${encodeURIComponent(query)}&file_type=json&limit=10&tag_names=housing`)
  const items = (data.seriess ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        title: item.title,
        frequency: item.frequency,
        units: item.units,
        seasonal_adjustment: item.seasonal_adjustment,
    })),
  }
}, { method: 'search_series' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getHpi, searchSeries }

console.log('settlegrid-fhfa MCP server ready')
console.log('Methods: get_hpi, search_series')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
