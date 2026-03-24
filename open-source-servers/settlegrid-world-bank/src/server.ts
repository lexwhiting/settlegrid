/**
 * settlegrid-world-bank — World Bank Indicators MCP Server
 *
 * Wraps the free World Bank API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_indicator(country, indicator)  — Fetch indicator time series   (2¢)
 *   search_indicators(query)           — Search available indicators   (1¢)
 *   get_countries()                    — List available countries      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetIndicatorInput {
  country: string
  indicator: string
  startYear?: number
  endYear?: number
}

interface SearchIndicatorsInput {
  query: string
  limit?: number
}

interface GetCountriesInput {
  region?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const WB_BASE = 'https://api.worldbank.org/v2'

async function wbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${WB_BASE}${path}`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '500')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString())
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`World Bank API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'world-bank',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_indicator: { costCents: 2, displayName: 'Get Indicator Data' },
      search_indicators: { costCents: 1, displayName: 'Search Indicators' },
      get_countries: { costCents: 1, displayName: 'List Countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIndicator = sg.wrap(async (args: GetIndicatorInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO 3166-1 alpha-2 or alpha-3 code, e.g. "US", "BRA")')
  }
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required (e.g. "NY.GDP.MKTP.CD" for GDP)')
  }

  const country = args.country.toUpperCase().trim()
  const indicator = args.indicator.trim()
  const startYear = args.startYear ?? 2000
  const endYear = args.endYear ?? new Date().getFullYear()

  const data = await wbFetch<
    [{ page: number; pages: number; total: number }, Array<{
      indicator: { id: string; value: string }
      country: { id: string; value: string }
      date: string
      value: number | null
    }>]
  >(`/country/${country}/indicator/${indicator}`, {
    date: `${startYear}:${endYear}`,
  })

  // World Bank returns [metadata, dataArray]
  const [meta, records] = data
  if (!records || records.length === 0) {
    throw new Error(`No data found for ${indicator} in ${country} (${startYear}-${endYear})`)
  }

  return {
    country: records[0]?.country?.value ?? country,
    countryCode: country,
    indicator: records[0]?.indicator?.value ?? indicator,
    indicatorCode: indicator,
    dateRange: { start: startYear, end: endYear },
    totalRecords: meta?.total ?? records.length,
    data: records
      .filter((r) => r.value !== null)
      .map((r) => ({ year: parseInt(r.date, 10), value: r.value }))
      .sort((a, b) => a.year - b.year),
  }
}, { method: 'get_indicator' })

const searchIndicators = sg.wrap(async (args: SearchIndicatorsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (e.g. "GDP", "poverty", "life expectancy")')
  }
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100)

  const data = await wbFetch<
    [{ page: number; total: number }, Array<{
      id: string
      name: string
      sourceNote: string
      sourceOrganization: string
    }>]
  >('/indicator', {
    per_page: String(limit),
  })

  // Client-side filter since WB API search is limited
  const query = args.query.toLowerCase()
  const [, indicators] = data
  const filtered = (indicators ?? [])
    .filter((ind) =>
      ind.name.toLowerCase().includes(query) ||
      ind.id.toLowerCase().includes(query) ||
      ind.sourceNote?.toLowerCase().includes(query)
    )
    .slice(0, limit)

  // If client-side filtering yields nothing, try the topic-based search
  if (filtered.length === 0) {
    const topicData = await wbFetch<
      [{ page: number; total: number }, Array<{
        id: string
        name: string
        sourceNote: string
        sourceOrganization: string
      }>]
    >('/indicator', {
      per_page: '1000',
    })

    const [, allIndicators] = topicData
    const refiltered = (allIndicators ?? [])
      .filter((ind) =>
        ind.name.toLowerCase().includes(query) ||
        ind.id.toLowerCase().includes(query)
      )
      .slice(0, limit)

    return {
      query: args.query,
      count: refiltered.length,
      indicators: refiltered.map((ind) => ({
        id: ind.id,
        name: ind.name,
        description: ind.sourceNote?.slice(0, 300) ?? '',
        source: ind.sourceOrganization ?? '',
      })),
    }
  }

  return {
    query: args.query,
    count: filtered.length,
    indicators: filtered.map((ind) => ({
      id: ind.id,
      name: ind.name,
      description: ind.sourceNote?.slice(0, 300) ?? '',
      source: ind.sourceOrganization ?? '',
    })),
  }
}, { method: 'search_indicators' })

const getCountries = sg.wrap(async (args: GetCountriesInput) => {
  const data = await wbFetch<
    [{ page: number; total: number }, Array<{
      id: string
      iso2Code: string
      name: string
      region: { id: string; value: string }
      capitalCity: string
      longitude: string
      latitude: string
      incomeLevel: { id: string; value: string }
    }>]
  >('/country', { per_page: '500' })

  const [, countries] = data
  let filtered = (countries ?? []).filter((c) => c.region.value !== 'Aggregates')

  if (args.region) {
    const region = args.region.toLowerCase()
    filtered = filtered.filter((c) =>
      c.region.value.toLowerCase().includes(region)
    )
  }

  return {
    count: filtered.length,
    countries: filtered.map((c) => ({
      code: c.id,
      iso2: c.iso2Code,
      name: c.name,
      region: c.region.value,
      capital: c.capitalCity || null,
      incomeLevel: c.incomeLevel.value,
      coordinates: c.latitude && c.longitude
        ? { lat: parseFloat(c.latitude), lon: parseFloat(c.longitude) }
        : null,
    })),
  }
}, { method: 'get_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIndicator, searchIndicators, getCountries }

// ─── REST Alternative (uncomment to serve as HTTP) ──────────────────────────
//
// import { settlegridMiddleware } from '@settlegrid/mcp'
// const middleware = settlegridMiddleware({
//   toolSlug: 'world-bank',
//   pricing: { defaultCostCents: 1, methods: { get_indicator: { costCents: 2 } } },
//   routes: { ... },
// })

console.log('settlegrid-world-bank MCP server ready')
console.log('Methods: get_indicator, search_indicators, get_countries')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
