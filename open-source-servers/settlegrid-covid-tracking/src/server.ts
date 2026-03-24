/**
 * settlegrid-covid-tracking — COVID Tracking MCP Server
 *
 * COVID-19 global and country-level statistics with historical data.
 *
 * Methods:
 *   get_global()                  — Get global COVID-19 totals  (1¢)
 *   get_country(country)          — Get COVID-19 stats for a specific country  (1¢)
 *   get_historical(country, days) — Get historical COVID-19 data for a country  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetGlobalInput {

}

interface GetCountryInput {
  country: string
}

interface GetHistoricalInput {
  country: string
  days?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://disease.sh/v3/covid-19'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-covid-tracking/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`COVID Tracking API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'covid-tracking',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_global: { costCents: 1, displayName: 'Get Global' },
      get_country: { costCents: 1, displayName: 'Get Country' },
      get_historical: { costCents: 1, displayName: 'Get Historical' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getGlobal = sg.wrap(async (args: GetGlobalInput) => {

  const data = await apiFetch<any>(`/all`)
  return {
    cases: data.cases,
    deaths: data.deaths,
    recovered: data.recovered,
    active: data.active,
    todayCases: data.todayCases,
    todayDeaths: data.todayDeaths,
    population: data.population,
  }
}, { method: 'get_global' })

const getCountry = sg.wrap(async (args: GetCountryInput) => {
  if (!args.country || typeof args.country !== 'string') throw new Error('country is required')
  const country = args.country.trim()
  const data = await apiFetch<any>(`/countries/${encodeURIComponent(country)}`)
  return {
    country: data.country,
    cases: data.cases,
    deaths: data.deaths,
    recovered: data.recovered,
    active: data.active,
    casesPerOneMillion: data.casesPerOneMillion,
    deathsPerOneMillion: data.deathsPerOneMillion,
  }
}, { method: 'get_country' })

const getHistorical = sg.wrap(async (args: GetHistoricalInput) => {
  if (!args.country || typeof args.country !== 'string') throw new Error('country is required')
  const country = args.country.trim()
  const days = typeof args.days === 'string' ? args.days.trim() : ''
  const data = await apiFetch<any>(`/historical/${encodeURIComponent(country)}?lastdays=${encodeURIComponent(days)}`)
  return {
    country: data.country,
    timeline: data.timeline,
  }
}, { method: 'get_historical' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getGlobal, getCountry, getHistorical }

console.log('settlegrid-covid-tracking MCP server ready')
console.log('Methods: get_global, get_country, get_historical')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
