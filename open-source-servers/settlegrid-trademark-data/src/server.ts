/**
 * settlegrid-trademark-data — Trademark Data MCP Server
 *
 * Wraps USPTO trademark endpoints with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_trademarks(query) — search trademarks (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string }

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'trademark-data',
  pricing: { defaultCostCents: 1, methods: { search_trademarks: { costCents: 1, displayName: 'Search Trademarks' } } },
})

const searchTrademarks = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const url = `https://tsdr.uspto.gov/documentxml?searchTerm=${encodeURIComponent(args.query)}`
  try {
    const data = await apiFetch<any>(url)
    return { query: args.query, results: data }
  } catch {
    return {
      query: args.query,
      note: 'USPTO TSDR may require specific serial number format. Try with a serial number like 97123456.',
      search_url: `https://tmsearch.uspto.gov/bin/gate.exe?f=login&p_lang=english&p_d=trmk`,
    }
  }
}, { method: 'search_trademarks' })

export { searchTrademarks }

console.log('settlegrid-trademark-data MCP server ready')
console.log('Methods: search_trademarks')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
