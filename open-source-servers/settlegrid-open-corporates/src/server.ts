/**
 * settlegrid-open-corporates — OpenCorporates MCP Server
 *
 * Wraps the OpenCorporates API for company records with SettleGrid billing.
 * No API key needed for basic access.
 *
 * Methods:
 *   search_companies(query, jurisdiction?)           — Search companies  (1¢)
 *   get_company(jurisdiction, company_number)        — Company details   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string; jurisdiction?: string }
interface GetCompanyInput { jurisdiction: string; company_number: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.opencorporates.com/v0.4'

async function ocFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Not found')
    if (res.status === 429) throw new Error('Rate limit exceeded')
    const body = await res.text().catch(() => '')
    throw new Error(`OpenCorporates API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatCompany(c: Record<string, unknown>) {
  return {
    name: c.name,
    companyNumber: c.company_number,
    jurisdiction: c.jurisdiction_code,
    status: c.current_status || null,
    type: c.company_type || null,
    incorporationDate: c.incorporation_date || null,
    dissolutionDate: c.dissolution_date || null,
    registeredAddress: c.registered_address_in_full || null,
    opencorporatesUrl: c.opencorporates_url,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'open-corporates',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_companies: { costCents: 1, displayName: 'Search Companies' },
      get_company: { costCents: 1, displayName: 'Get Company' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchCompanies = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  if (query.length === 0 || query.length > 200) throw new Error('query must be 1-200 characters')
  let url = `/companies/search?q=${encodeURIComponent(query)}`
  if (args.jurisdiction && typeof args.jurisdiction === 'string') {
    url += `&jurisdiction_code=${encodeURIComponent(args.jurisdiction.trim().toLowerCase())}`
  }
  const data = await ocFetch<{ results: { companies: Array<{ company: Record<string, unknown> }> ; total_count: number } }>(url)
  return {
    query, jurisdiction: args.jurisdiction || null,
    totalCount: data.results.total_count,
    companies: data.results.companies.slice(0, 15).map(c => formatCompany(c.company)),
  }
}, { method: 'search_companies' })

const getCompany = sg.wrap(async (args: GetCompanyInput) => {
  if (!args.jurisdiction || typeof args.jurisdiction !== 'string') throw new Error('jurisdiction is required')
  if (!args.company_number || typeof args.company_number !== 'string') throw new Error('company_number is required')
  const jur = args.jurisdiction.trim().toLowerCase()
  const num = args.company_number.trim()
  const data = await ocFetch<{ results: { company: Record<string, unknown> } }>(`/companies/${encodeURIComponent(jur)}/${encodeURIComponent(num)}`)
  return formatCompany(data.results.company)
}, { method: 'get_company' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchCompanies, getCompany }

console.log('settlegrid-open-corporates MCP server ready')
console.log('Methods: search_companies, get_company')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
