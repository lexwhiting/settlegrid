/**
 * settlegrid-renewable-tracker — Renewable Energy Production MCP Server
 *
 * Tracks renewable energy production by country via World Bank data.
 * No API key needed.
 *
 * Methods:
 *   get_renewable_share(country_code)       (1¢)
 *   get_renewable_trend(country_code)       (1¢)
 *   compare_countries(codes)                (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetRenewableShareInput { country_code: string }
interface GetRenewableTrendInput { country_code: string; years?: number }
interface CompareCountriesInput { codes: string }

const API_BASE = 'https://api.worldbank.org/v2'
const USER_AGENT = 'settlegrid-renewable-tracker/1.0 (contact@settlegrid.ai)'
const INDICATOR = 'EG.FEC.RNEW.ZS'

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}&format=json`
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`World Bank API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'renewable-tracker',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_renewable_share: { costCents: 1, displayName: 'Get renewable energy share' },
      get_renewable_trend: { costCents: 1, displayName: 'Get renewable energy trend' },
      compare_countries: { costCents: 2, displayName: 'Compare countries renewable energy' },
    },
  },
})

const getRenewableShare = sg.wrap(async (args: GetRenewableShareInput) => {
  if (!args.country_code) throw new Error('country_code is required (ISO alpha-2 or alpha-3)')
  const code = args.country_code.toUpperCase().trim()
  const data = await apiFetch<unknown[]>(
    `/country/${encodeURIComponent(code)}/indicator/${INDICATOR}?date=2020:2024&per_page=5`
  )
  return { country_code: code, indicator: INDICATOR, data: Array.isArray(data) && data[1] ? data[1] : data }
}, { method: 'get_renewable_share' })

const getRenewableTrend = sg.wrap(async (args: GetRenewableTrendInput) => {
  if (!args.country_code) throw new Error('country_code is required')
  const code = args.country_code.toUpperCase().trim()
  const years = Math.min(Math.max(args.years ?? 10, 1), 30)
  const endYear = 2024
  const startYear = endYear - years
  const data = await apiFetch<unknown[]>(
    `/country/${encodeURIComponent(code)}/indicator/${INDICATOR}?date=${startYear}:${endYear}&per_page=${years + 1}`
  )
  return { country_code: code, years, data: Array.isArray(data) && data[1] ? data[1] : data }
}, { method: 'get_renewable_trend' })

const compareCountries = sg.wrap(async (args: CompareCountriesInput) => {
  if (!args.codes || typeof args.codes !== 'string') throw new Error('codes is required (semicolon-separated ISO codes)')
  const codes = args.codes.toUpperCase().replace(/\s/g, '')
  const data = await apiFetch<unknown[]>(
    `/country/${encodeURIComponent(codes)}/indicator/${INDICATOR}?date=2020:2024&per_page=100`
  )
  return { codes, data: Array.isArray(data) && data[1] ? data[1] : data }
}, { method: 'compare_countries' })

export { getRenewableShare, getRenewableTrend, compareCountries }

console.log('settlegrid-renewable-tracker MCP server ready')
console.log('Methods: get_renewable_share, get_renewable_trend, compare_countries')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
