/**
 * settlegrid-esg-scores — Company ESG Ratings MCP Server
 *
 * Provides company ESG (Environmental, Social, Governance) scores.
 * Uses ESG Enterprise API (free tier).
 *
 * Methods:
 *   get_esg_score(symbol)           (2¢)
 *   search_companies(query)         (1¢)
 *   get_industry_benchmark(sector)  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetEsgScoreInput { symbol: string }
interface SearchCompaniesInput { query: string }
interface GetIndustryBenchmarkInput { sector: string }

const API_BASE = 'https://tf689y3hbj.execute-api.us-east-1.amazonaws.com'
const USER_AGENT = 'settlegrid-esg-scores/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  const key = process.env.ESG_ENTERPRISE_KEY || ''
  if (key) url.searchParams.set('token', key)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ESG API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'esg-scores',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_esg_score: { costCents: 2, displayName: 'Get ESG score for a company' },
      search_companies: { costCents: 1, displayName: 'Search companies for ESG data' },
      get_industry_benchmark: { costCents: 1, displayName: 'Get industry ESG benchmark' },
    },
  },
})

const getEsgScore = sg.wrap(async (args: GetEsgScoreInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') throw new Error('symbol is required (stock ticker)')
  const data = await apiFetch<Record<string, unknown>>(
    `/dev/esg/${encodeURIComponent(args.symbol.toUpperCase())}`
  )
  return { symbol: args.symbol.toUpperCase(), ...data }
}, { method: 'get_esg_score' })

const searchCompanies = sg.wrap(async (args: SearchCompaniesInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const data = await apiFetch<Record<string, unknown>>('/dev/search', { q: args.query })
  return { query: args.query, ...data }
}, { method: 'search_companies' })

const getIndustryBenchmark = sg.wrap(async (args: GetIndustryBenchmarkInput) => {
  if (!args.sector || typeof args.sector !== 'string') throw new Error('sector is required')
  const data = await apiFetch<Record<string, unknown>>('/dev/esg-sector', { sector: args.sector })
  return { sector: args.sector, ...data }
}, { method: 'get_industry_benchmark' })

export { getEsgScore, searchCompanies, getIndustryBenchmark }

console.log('settlegrid-esg-scores MCP server ready')
console.log('Methods: get_esg_score, search_companies, get_industry_benchmark')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
