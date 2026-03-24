/**
 * settlegrid-university-domains — University Domains MCP Server
 *
 * Wraps the Hipo Labs University Domains API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_universities(name)           — Search universities        (1¢)
 *   search_by_country(country, name?)   — Universities by country    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { name: string }
interface CountrySearchInput { country: string; name?: string }

interface University {
  name: string
  country: string
  alpha_two_code: string
  domains: string[]
  web_pages: string[]
  'state-province': string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'http://universities.hipolabs.com'

async function uniFetch(path: string): Promise<University[]> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`University API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<University[]>
}

function formatUni(u: University) {
  return {
    name: u.name,
    country: u.country,
    countryCode: u.alpha_two_code,
    domains: u.domains,
    websites: u.web_pages,
    stateProvince: u['state-province'],
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'university-domains',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_universities: { costCents: 1, displayName: 'Search Universities' },
      search_by_country: { costCents: 1, displayName: 'Search by Country' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchUniversities = sg.wrap(async (args: SearchInput) => {
  if (!args.name || typeof args.name !== 'string') throw new Error('name is required')
  const name = args.name.trim()
  if (name.length === 0 || name.length > 100) throw new Error('name must be 1-100 characters')
  const data = await uniFetch(`/search?name=${encodeURIComponent(name)}`)
  return { query: name, count: data.length, universities: data.slice(0, 25).map(formatUni) }
}, { method: 'search_universities' })

const searchByCountry = sg.wrap(async (args: CountrySearchInput) => {
  if (!args.country || typeof args.country !== 'string') throw new Error('country is required')
  const country = args.country.trim()
  if (country.length === 0 || country.length > 100) throw new Error('country must be 1-100 characters')
  let url = `/search?country=${encodeURIComponent(country)}`
  if (args.name && typeof args.name === 'string') {
    url += `&name=${encodeURIComponent(args.name.trim())}`
  }
  const data = await uniFetch(url)
  return { country, name: args.name || null, count: data.length, universities: data.slice(0, 25).map(formatUni) }
}, { method: 'search_by_country' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchUniversities, searchByCountry }

console.log('settlegrid-university-domains MCP server ready')
console.log('Methods: search_universities, search_by_country')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
