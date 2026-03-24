/**
 * settlegrid-sec-companies — SEC EDGAR MCP Server
 *
 * Wraps the SEC EDGAR full-text search API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_companies(query)             — Search SEC EDGAR         (1¢)
 *   get_filings(cik, form_type?)       — Get company filings       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface FilingsInput { cik: string; form_type?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const SEARCH_BASE = 'https://efts.sec.gov/LATEST'
const EDGAR_BASE = 'https://data.sec.gov'
const USER_AGENT = 'settlegrid-sec/1.0 (contact@settlegrid.ai)'

async function secFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`SEC API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function padCik(cik: string): string {
  return cik.replace(/^0+/, '').padStart(10, '0')
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'sec-companies',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_companies: { costCents: 1, displayName: 'Search Companies' },
      get_filings: { costCents: 1, displayName: 'Get Filings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchCompanies = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  if (query.length === 0 || query.length > 100) throw new Error('query must be 1-100 characters')
  const data = await secFetch<{ hits: { hits: Array<{ _source: { entity_name: string; tickers: string[]; ciks: string[]; entity_id: string } }> ; total: { value: number } } }>(`${SEARCH_BASE}/search-index?q=${encodeURIComponent(query)}&dateRange=custom&startdt=2020-01-01&enddt=2026-12-31`)
  const seen = new Set<string>()
  const companies = data.hits.hits
    .filter(h => { const id = h._source.entity_id; if (seen.has(id)) return false; seen.add(id); return true })
    .slice(0, 15)
    .map(h => ({ name: h._source.entity_name, tickers: h._source.tickers || [], cik: h._source.ciks?.[0] || null }))
  return { query, totalHits: data.hits.total.value, companies }
}, { method: 'search_companies' })

const getFilings = sg.wrap(async (args: FilingsInput) => {
  if (!args.cik || typeof args.cik !== 'string') throw new Error('cik is required')
  const cik = padCik(args.cik.trim())
  if (!/^\d{10}$/.test(cik)) throw new Error('Invalid CIK format')
  const data = await secFetch<{ filings: { recent: { form: string[]; filingDate: string[]; primaryDocument: string[]; accessionNumber: string[]; primaryDocDescription: string[] } }; name: string; tickers: string[] }>(`${EDGAR_BASE}/submissions/CIK${cik}.json`)
  const recent = data.filings.recent
  let indices = Array.from({ length: recent.form.length }, (_, i) => i)
  if (args.form_type && typeof args.form_type === 'string') {
    const ft = args.form_type.toUpperCase().trim()
    indices = indices.filter(i => recent.form[i] === ft)
  }
  return {
    name: data.name, cik, tickers: data.tickers || [],
    filings: indices.slice(0, 20).map(i => ({
      form: recent.form[i], filingDate: recent.filingDate[i],
      description: recent.primaryDocDescription[i] || null,
      document: recent.primaryDocument[i],
      accessionNumber: recent.accessionNumber[i],
    })),
  }
}, { method: 'get_filings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchCompanies, getFilings }

console.log('settlegrid-sec-companies MCP server ready')
console.log('Methods: search_companies, get_filings')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
