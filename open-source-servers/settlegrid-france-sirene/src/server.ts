/**
 * settlegrid-france-sirene — French Company Data MCP Server
 *
 * Wraps Recherche Entreprises API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_companies(query, limit?)        — Search companies (1¢)
 *   get_company(siret)                     — Get company by SIRET (1¢)
 *   search_by_activity(naf_code)           — Search by NAF code (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchCompaniesInput {
  query: string
  limit?: number
}

interface GetCompanyInput {
  siret: string
}

interface SearchByActivityInput {
  naf_code: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://recherche-entreprises.api.gouv.fr'
const USER_AGENT = 'settlegrid-france-sirene/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Recherche Entreprises API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'france-sirene',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_companies: { costCents: 1, displayName: 'Search French companies' },
      get_company: { costCents: 1, displayName: 'Get company by SIRET' },
      search_by_activity: { costCents: 1, displayName: 'Search by NAF activity code' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchCompanies = sg.wrap(async (args: SearchCompaniesInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (company name or keyword)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['per_page'] = String(args.limit)
  const data = await apiFetch<Record<string, unknown>>('/search', { params })
  return data
}, { method: 'search_companies' })

const getCompany = sg.wrap(async (args: GetCompanyInput) => {
  if (!args.siret || typeof args.siret !== 'string') {
    throw new Error('siret is required (14-digit SIRET number)')
  }
  const data = await apiFetch<Record<string, unknown>>('/search', {
    params: { q: args.siret },
  })
  return data
}, { method: 'get_company' })

const searchByActivity = sg.wrap(async (args: SearchByActivityInput) => {
  if (!args.naf_code || typeof args.naf_code !== 'string') {
    throw new Error('naf_code is required (NAF/APE activity code)')
  }
  const data = await apiFetch<Record<string, unknown>>('/search', {
    params: { activite_principale: args.naf_code },
  })
  return data
}, { method: 'search_by_activity' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchCompanies, getCompany, searchByActivity }

console.log('settlegrid-france-sirene MCP server ready')
console.log('Methods: search_companies, get_company, search_by_activity')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
