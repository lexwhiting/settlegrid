/**
 * settlegrid-uk-companies — UK Companies House MCP Server
 *
 * Search UK company registrations and filings.
 *
 * Methods:
 *   search_companies(query)       — Search for UK companies by name  (2¢)
 *   get_company(company_number)   — Get details of a specific UK company by number  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchCompaniesInput {
  query: string
}

interface GetCompanyInput {
  company_number: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.company-information.service.gov.uk'
const API_KEY = process.env.COMPANIES_HOUSE_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-uk-companies/1.0', Authorization: `Bearer ${API_KEY}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`UK Companies House API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'uk-companies',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_companies: { costCents: 2, displayName: 'Search Companies' },
      get_company: { costCents: 2, displayName: 'Get Company' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchCompanies = sg.wrap(async (args: SearchCompaniesInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/search/companies?q=${encodeURIComponent(query)}&items_per_page=10`)
  const items = (data.items ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        company_number: item.company_number,
        title: item.title,
        company_status: item.company_status,
        date_of_creation: item.date_of_creation,
        address: item.address,
    })),
  }
}, { method: 'search_companies' })

const getCompany = sg.wrap(async (args: GetCompanyInput) => {
  if (!args.company_number || typeof args.company_number !== 'string') throw new Error('company_number is required')
  const company_number = args.company_number.trim()
  const data = await apiFetch<any>(`/company/${encodeURIComponent(company_number)}`)
  return {
    company_name: data.company_name,
    company_number: data.company_number,
    company_status: data.company_status,
    type: data.type,
    date_of_creation: data.date_of_creation,
    registered_office_address: data.registered_office_address,
    sic_codes: data.sic_codes,
  }
}, { method: 'get_company' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchCompanies, getCompany }

console.log('settlegrid-uk-companies MCP server ready')
console.log('Methods: search_companies, get_company')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
