/**
 * settlegrid-economic-data — FRED Economic Data MCP Server
 *
 * Wraps the Federal Reserve Economic Data (FRED) API with SettleGrid billing.
 * Requires a free FRED API key from https://fred.stlouisfed.org/docs/api/api_key.html
 *
 * Methods:
 *   get_series(seriesId)      — Fetch time series observations  (2¢)
 *   search_series(query)      — Search 800K+ economic series    (1¢)
 *   get_categories()          — Browse category tree            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetSeriesInput {
  seriesId: string
  limit?: number
  sortOrder?: 'asc' | 'desc'
}

interface SearchSeriesInput {
  query: string
  limit?: number
}

interface GetCategoriesInput {
  categoryId?: number
}

interface FredObservation {
  date: string
  value: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const FRED_BASE = 'https://api.stlouisfed.org/fred'

function getFredKey(): string {
  const key = process.env.FRED_API_KEY
  if (!key) throw new Error('FRED_API_KEY environment variable is required')
  return key
}

async function fredFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${FRED_BASE}${path}`)
  url.searchParams.set('api_key', getFredKey())
  url.searchParams.set('file_type', 'json')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString())
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FRED API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'economic-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_series: { costCents: 2, displayName: 'Get Time Series' },
      search_series: { costCents: 1, displayName: 'Search Series' },
      get_categories: { costCents: 1, displayName: 'Browse Categories' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSeries = sg.wrap(async (args: GetSeriesInput) => {
  if (!args.seriesId || typeof args.seriesId !== 'string') {
    throw new Error('seriesId is required (e.g. "GDP", "UNRATE", "CPIAUCSL")')
  }
  const limit = Math.min(Math.max(args.limit ?? 100, 1), 1000)

  // Fetch series info and observations in parallel
  const [info, observations] = await Promise.all([
    fredFetch<{
      seriess: Array<{
        id: string
        title: string
        frequency: string
        units: string
        seasonal_adjustment: string
        last_updated: string
      }>
    }>('/series', { series_id: args.seriesId.toUpperCase() }),
    fredFetch<{ observations: FredObservation[] }>('/series/observations', {
      series_id: args.seriesId.toUpperCase(),
      limit: String(limit),
      sort_order: args.sortOrder ?? 'desc',
    }),
  ])

  const series = info.seriess[0]
  return {
    series: series ? {
      id: series.id,
      title: series.title,
      frequency: series.frequency,
      units: series.units,
      seasonalAdjustment: series.seasonal_adjustment,
      lastUpdated: series.last_updated,
    } : null,
    observations: observations.observations
      .filter((o) => o.value !== '.')
      .map((o) => ({ date: o.date, value: parseFloat(o.value) })),
  }
}, { method: 'get_series' })

const searchSeries = sg.wrap(async (args: SearchSeriesInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (e.g. "unemployment rate")')
  }
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100)

  const data = await fredFetch<{
    seriess: Array<{
      id: string
      title: string
      frequency: string
      units: string
      popularity: number
      last_updated: string
    }>
  }>('/series/search', {
    search_text: args.query,
    limit: String(limit),
    order_by: 'popularity',
    sort_order: 'desc',
  })

  return {
    query: args.query,
    count: data.seriess.length,
    series: data.seriess.map((s) => ({
      id: s.id,
      title: s.title,
      frequency: s.frequency,
      units: s.units,
      popularity: s.popularity,
      lastUpdated: s.last_updated,
    })),
  }
}, { method: 'search_series' })

const getCategories = sg.wrap(async (args: GetCategoriesInput) => {
  const categoryId = args.categoryId ?? 0

  const [category, children] = await Promise.all([
    categoryId > 0
      ? fredFetch<{ categories: Array<{ id: number; name: string; parent_id: number }> }>(
          '/category', { category_id: String(categoryId) }
        )
      : Promise.resolve({ categories: [{ id: 0, name: 'Root', parent_id: 0 }] }),
    fredFetch<{ categories: Array<{ id: number; name: string; parent_id: number }> }>(
      '/category/children', { category_id: String(categoryId) }
    ),
  ])

  return {
    category: category.categories[0],
    children: children.categories.map((c) => ({
      id: c.id,
      name: c.name,
      parentId: c.parent_id,
    })),
  }
}, { method: 'get_categories' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSeries, searchSeries, getCategories }

// ─── REST Alternative (uncomment to serve as HTTP) ──────────────────────────
//
// import { settlegridMiddleware } from '@settlegrid/mcp'
// const middleware = settlegridMiddleware({
//   toolSlug: 'economic-data',
//   pricing: { defaultCostCents: 1, methods: { get_series: { costCents: 2 } } },
//   routes: { ... },
// })

console.log('settlegrid-economic-data MCP server ready')
console.log('Methods: get_series, search_series, get_categories')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
