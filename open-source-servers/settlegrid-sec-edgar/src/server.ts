/**
 * settlegrid-sec-edgar — SEC EDGAR MCP Server
 *
 * Wraps the SEC EDGAR API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_filings(q)                        (2¢)
 *   get_company_filings(cik)                 (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchFilingsInput {
  q: string
  dateRange?: string
  forms?: string
}

interface GetCompanyFilingsInput {
  cik: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://efts.sec.gov/LATEST'
const USER_AGENT = 'settlegrid-sec-edgar/1.0 contact@settlegrid.ai'

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
    throw new Error(`SEC EDGAR API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'sec-edgar',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_filings: { costCents: 2, displayName: 'Full-text search SEC filings' },
      get_company_filings: { costCents: 2, displayName: 'Get all filings for a company by CIK' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchFilings = sg.wrap(async (args: SearchFilingsInput) => {
  if (!args.q || typeof args.q !== 'string') {
    throw new Error('q is required (search query)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.q
  if (args.dateRange !== undefined) params['dateRange'] = String(args.dateRange)
  if (args.forms !== undefined) params['forms'] = String(args.forms)

  const data = await apiFetch<Record<string, unknown>>('/search-index', {
    params,
  })

  return data
}, { method: 'search_filings' })

const getCompanyFilings = sg.wrap(async (args: GetCompanyFilingsInput) => {
  if (!args.cik || typeof args.cik !== 'string') {
    throw new Error('cik is required (company cik number (e.g. 0000320193 for apple))')
  }

  const params: Record<string, string> = {}
  params['cik'] = String(args.cik)

  const data = await apiFetch<Record<string, unknown>>('', {
    params,
  })

  return data
}, { method: 'get_company_filings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchFilings, getCompanyFilings }

console.log('settlegrid-sec-edgar MCP server ready')
console.log('Methods: search_filings, get_company_filings')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
