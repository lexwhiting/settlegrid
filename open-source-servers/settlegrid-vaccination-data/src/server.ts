/**
 * settlegrid-vaccination-data — Vaccination Data MCP Server
 *
 * COVID-19 vaccination coverage statistics by country.
 *
 * Methods:
 *   get_global_coverage()         — Get global vaccination coverage totals  (1¢)
 *   get_country_coverage(country) — Get vaccination coverage for a country  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetGlobalCoverageInput {

}

interface GetCountryCoverageInput {
  country: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://disease.sh/v3/covid-19/vaccine'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-vaccination-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Vaccination Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'vaccination-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_global_coverage: { costCents: 1, displayName: 'Get Global Coverage' },
      get_country_coverage: { costCents: 1, displayName: 'Get Country Coverage' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getGlobalCoverage = sg.wrap(async (args: GetGlobalCoverageInput) => {

  const data = await apiFetch<any>(`/coverage?lastdays=30&fullData=true`)
  return {
    date: data.date,
    total: data.total,
    daily: data.daily,
  }
}, { method: 'get_global_coverage' })

const getCountryCoverage = sg.wrap(async (args: GetCountryCoverageInput) => {
  if (!args.country || typeof args.country !== 'string') throw new Error('country is required')
  const country = args.country.trim()
  const data = await apiFetch<any>(`/coverage/countries/${encodeURIComponent(country)}?lastdays=30&fullData=true`)
  const items = (data.timeline ?? []).slice(0, 30)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        date: item.date,
        total: item.total,
        daily: item.daily,
    })),
  }
}, { method: 'get_country_coverage' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getGlobalCoverage, getCountryCoverage }

console.log('settlegrid-vaccination-data MCP server ready')
console.log('Methods: get_global_coverage, get_country_coverage')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
