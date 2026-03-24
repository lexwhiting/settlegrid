/**
 * settlegrid-travel-advisory — Travel Advisory MCP Server
 *
 * Provides government travel advisories from multiple sources.
 * No API key needed.
 *
 * Methods:
 *   get_all_advisories()                   (1¢)
 *   get_advisory_by_country(country_code)  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetAdvisoryByCountryInput {
  country_code: string
}

const API_BASE = 'https://www.travel-advisory.info/api'
const USER_AGENT = 'settlegrid-travel-advisory/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(params: Record<string, string> = {}): Promise<T> {
  const url = new URL(API_BASE)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Travel Advisory API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'travel-advisory',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_all_advisories: { costCents: 1, displayName: 'Get all travel advisories' },
      get_advisory_by_country: { costCents: 1, displayName: 'Get advisory for a country' },
    },
  },
})

const getAllAdvisories = sg.wrap(async () => {
  const data = await apiFetch<Record<string, unknown>>()
  return data
}, { method: 'get_all_advisories' })

const getAdvisoryByCountry = sg.wrap(async (args: GetAdvisoryByCountryInput) => {
  if (!args.country_code || typeof args.country_code !== 'string') {
    throw new Error('country_code is required (ISO 3166-1 alpha-2, e.g. US, GB, DE)')
  }
  const code = args.country_code.toUpperCase().trim()
  const data = await apiFetch<Record<string, unknown>>({ countrycode: code })
  return { country_code: code, ...data }
}, { method: 'get_advisory_by_country' })

export { getAllAdvisories, getAdvisoryByCountry }

console.log('settlegrid-travel-advisory MCP server ready')
console.log('Methods: get_all_advisories, get_advisory_by_country')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
