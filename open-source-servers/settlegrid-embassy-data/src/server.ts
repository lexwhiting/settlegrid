/**
 * settlegrid-embassy-data — Embassy Data MCP Server
 *
 * Provides embassy and consulate locations worldwide.
 * Uses the Embassy Pages API. No API key needed.
 *
 * Methods:
 *   get_embassies_in(country)              (1¢)
 *   get_embassies_of(country)              (1¢)
 *   search_embassies(query)                (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetEmbassiesInInput { country: string }
interface GetEmbassiesOfInput { country: string }
interface SearchEmbassiesInput { query: string }

const API_BASE = 'https://embassy-api.com/api/v1'
const USER_AGENT = 'settlegrid-embassy-data/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Embassy API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'embassy-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_embassies_in: { costCents: 1, displayName: 'Embassies located in a country' },
      get_embassies_of: { costCents: 1, displayName: 'Embassies of a country abroad' },
      search_embassies: { costCents: 1, displayName: 'Search embassies' },
    },
  },
})

const getEmbassiesIn = sg.wrap(async (args: GetEmbassiesInInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (country name or ISO code)')
  }
  const data = await apiFetch<Record<string, unknown>>(
    `/embassies/in/${encodeURIComponent(args.country.toLowerCase())}`
  )
  return { country: args.country, ...data }
}, { method: 'get_embassies_in' })

const getEmbassiesOf = sg.wrap(async (args: GetEmbassiesOfInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (country name or ISO code)')
  }
  const data = await apiFetch<Record<string, unknown>>(
    `/embassies/of/${encodeURIComponent(args.country.toLowerCase())}`
  )
  return { country: args.country, ...data }
}, { method: 'get_embassies_of' })

const searchEmbassies = sg.wrap(async (args: SearchEmbassiesInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const data = await apiFetch<Record<string, unknown>>(
    `/embassies/search?q=${encodeURIComponent(args.query)}`
  )
  return { query: args.query, ...data }
}, { method: 'search_embassies' })

export { getEmbassiesIn, getEmbassiesOf, searchEmbassies }

console.log('settlegrid-embassy-data MCP server ready')
console.log('Methods: get_embassies_in, get_embassies_of, search_embassies')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
