/**
 * settlegrid-airbnb-data — Inside Airbnb MCP Server
 *
 * Airbnb listing and market data from Inside Airbnb open dataset.
 *
 * Methods:
 *   get_cities()                  — List available cities with Airbnb data  (1¢)
 *   get_summary(country, city)    — Get listing summary for a city  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetCitiesInput {

}

interface GetSummaryInput {
  country: string
  city: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'http://data.insideairbnb.com'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-airbnb-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Inside Airbnb API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'airbnb-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_cities: { costCents: 1, displayName: 'Get Cities' },
      get_summary: { costCents: 1, displayName: 'Get Summary' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCities = sg.wrap(async (args: GetCitiesInput) => {

  const data = await apiFetch<any>(`/csv/index.json`)
  return {
    city: data.city,
    country: data.country,
    last_scraped: data.last_scraped,
    listings_url: data.listings_url,
  }
}, { method: 'get_cities' })

const getSummary = sg.wrap(async (args: GetSummaryInput) => {
  if (!args.country || typeof args.country !== 'string') throw new Error('country is required')
  const country = args.country.trim()
  if (!args.city || typeof args.city !== 'string') throw new Error('city is required')
  const city = args.city.trim()
  const data = await apiFetch<any>(`/csv/${encodeURIComponent(country)}/${encodeURIComponent(city)}/visualisations/listings.csv`)
  return {
    data: data.data,
  }
}, { method: 'get_summary' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCities, getSummary }

console.log('settlegrid-airbnb-data MCP server ready')
console.log('Methods: get_cities, get_summary')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
