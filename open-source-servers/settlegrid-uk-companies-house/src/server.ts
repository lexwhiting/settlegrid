/**
 * settlegrid-uk-companies-house — UK Companies House MCP Server
 *
 * Wraps the UK Companies House API with SettleGrid billing.
 * Requires COMPANIES_HOUSE_API_KEY environment variable.
 *
 * Methods:
 *   search_companies(q)                      (1¢)
 *   get_company(company_number)              (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchCompaniesInput {
  q: string
}

interface GetCompanyInput {
  company_number: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.company-information.service.gov.uk'
const USER_AGENT = 'settlegrid-uk-companies-house/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.COMPANIES_HOUSE_API_KEY
  if (!key) throw new Error('COMPANIES_HOUSE_API_KEY environment variable is required')
  return key
}

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'Authorization': `Basic ${getApiKey()}`,
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`UK Companies House API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'uk-companies-house',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_companies: { costCents: 1, displayName: 'Search for UK companies' },
      get_company: { costCents: 1, displayName: 'Get company details by number' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchCompanies = sg.wrap(async (args: SearchCompaniesInput) => {
  if (!args.q || typeof args.q !== 'string') {
    throw new Error('q is required (company name search)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.q

  const data = await apiFetch<Record<string, unknown>>('/search/companies', {
    params,
  })

  return data
}, { method: 'search_companies' })

const getCompany = sg.wrap(async (args: GetCompanyInput) => {
  if (!args.company_number || typeof args.company_number !== 'string') {
    throw new Error('company_number is required (company number (e.g. 00445790))')
  }

  const params: Record<string, string> = {}
  params['company_number'] = String(args.company_number)

  const data = await apiFetch<Record<string, unknown>>(`/company/${encodeURIComponent(String(args.company_number))}`, {
    params,
  })

  return data
}, { method: 'get_company' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchCompanies, getCompany }

console.log('settlegrid-uk-companies-house MCP server ready')
console.log('Methods: search_companies, get_company')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
