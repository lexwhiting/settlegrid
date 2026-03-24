/**
 * settlegrid-sec-filings — SEC Company Filings MCP Server
 *
 * Wraps SEC EDGAR full-text search with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_sec_filings(query, form_type?) — search filings (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface FilingInput { query: string; form_type?: string }

const API_BASE = 'https://efts.sec.gov/LATEST/search-index'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, { headers: { 'User-Agent': 'SettleGrid-MCP/1.0 contact@settlegrid.ai', 'Accept': 'application/json' } })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'sec-filings',
  pricing: { defaultCostCents: 1, methods: { search_sec_filings: { costCents: 1, displayName: 'Search Filings' } } },
})

const searchSecFilings = sg.wrap(async (args: FilingInput) => {
  if (!args.query) throw new Error('query is required')
  let url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(args.query)}&dateRange=custom&startdt=2020-01-01`
  if (args.form_type) url += `&forms=${args.form_type}`
  const data = await apiFetch<any>(url)
  return {
    total: data.hits?.total?.value || 0,
    filings: (data.hits?.hits || []).slice(0, 20).map((h: any) => ({
      entity_name: h._source?.entity_name,
      file_date: h._source?.file_date,
      form_type: h._source?.form_type,
      file_num: h._source?.file_num,
      period: h._source?.period_of_report,
    })),
  }
}, { method: 'search_sec_filings' })

export { searchSecFilings }

console.log('settlegrid-sec-filings MCP server ready')
console.log('Methods: search_sec_filings')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
