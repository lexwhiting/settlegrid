/**
 * settlegrid-sec-edgar — SEC EDGAR Filing Search MCP Server
 *
 * Wraps the SEC EDGAR full-text search and submissions APIs.
 * No API key needed. User-Agent header required by SEC.
 *
 * Methods:
 *   search_filings(query, dateRange?)   — Full-text search   (1¢)
 *   get_submissions(cik)                — Company filings    (1¢)
 *   get_company_facts(cik)              — XBRL facts         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string; dateRange?: string }
interface CikInput { cik: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const EFTS_BASE = 'https://efts.sec.gov/LATEST'
const DATA_BASE = 'https://data.sec.gov'
const UA = 'settlegrid-sec-edgar/1.0 (contact@settlegrid.ai)'

async function secFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`SEC API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function padCik(cik: string): string {
  const digits = cik.replace(/\D/g, '')
  return digits.padStart(10, '0')
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'sec-edgar',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_filings: { costCents: 1, displayName: 'Search Filings' },
      get_submissions: { costCents: 1, displayName: 'Company Submissions' },
      get_company_facts: { costCents: 1, displayName: 'Company XBRL Facts' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchFilings = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const url = new URL(`${EFTS_BASE}/search-index`)
  url.searchParams.set('q', args.query.trim())
  if (args.dateRange) url.searchParams.set('dateRange', args.dateRange)
  url.searchParams.set('from', '0')
  url.searchParams.set('size', '20')
  const data = await secFetch<Record<string, unknown>>(url.toString())
  return data
}, { method: 'search_filings' })

const getSubmissions = sg.wrap(async (args: CikInput) => {
  if (!args.cik || typeof args.cik !== 'string') {
    throw new Error('cik is required (e.g. "0000320193")')
  }
  const cik = padCik(args.cik)
  const data = await secFetch<Record<string, unknown>>(`${DATA_BASE}/submissions/CIK${cik}.json`)
  return data
}, { method: 'get_submissions' })

const getCompanyFacts = sg.wrap(async (args: CikInput) => {
  if (!args.cik || typeof args.cik !== 'string') {
    throw new Error('cik is required (e.g. "0000320193")')
  }
  const cik = padCik(args.cik)
  const data = await secFetch<Record<string, unknown>>(`${DATA_BASE}/api/xbrl/companyfacts/CIK${cik}.json`)
  return data
}, { method: 'get_company_facts' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchFilings, getSubmissions, getCompanyFacts }

console.log('settlegrid-sec-edgar MCP server ready')
console.log('Methods: search_filings, get_submissions, get_company_facts')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
