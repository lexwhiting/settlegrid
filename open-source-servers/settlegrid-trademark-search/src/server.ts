/**
 * settlegrid-trademark-search — USPTO Trademark MCP Server
 *
 * Wraps the USPTO Trademark API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_trademarks(query, rows?)        — Search trademarks   (1¢)
 *   get_trademark_status(serial_number)    — Trademark status     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string; rows?: number }
interface StatusInput { serial_number: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://developer.uspto.gov/ds-api'
const USER_AGENT = 'settlegrid-trademark-search/1.0 (contact@settlegrid.ai)'

async function usptoFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error('Not found')
    const body = await res.text().catch(() => '')
    throw new Error(`USPTO API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'trademark-search',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_trademarks: { costCents: 1, displayName: 'Search Trademarks' },
      get_trademark_status: { costCents: 1, displayName: 'Trademark Status' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchTrademarks = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  if (query.length === 0 || query.length > 200) throw new Error('query must be 1-200 characters')
  const rows = Math.min(Math.max(args.rows || 10, 1), 50)
  const data = await usptoFetch<{ response: { numFound: number; docs: Array<Record<string, unknown>> } }>(`/oa_citations/v2/citations?searchText=${encodeURIComponent(query)}&rows=${rows}`)
  return {
    query,
    totalFound: data.response?.numFound || 0,
    trademarks: (data.response?.docs || []).slice(0, rows).map(d => ({
      serialNumber: d.serialNumber || d.applicationNumberText,
      markText: d.markCurrentStatusExternalDescriptionText || d.markIdentification || d.citedMarkOwnerName,
      status: d.markCurrentStatusExternalDescriptionText || null,
      filingDate: d.applicationDate || d.filingDate || null,
      registrationNumber: d.registrationNumber || null,
      owner: d.citedMarkOwnerName || d.ownerName || null,
    })),
  }
}, { method: 'search_trademarks' })

const getTrademarkStatus = sg.wrap(async (args: StatusInput) => {
  if (!args.serial_number || typeof args.serial_number !== 'string') throw new Error('serial_number is required')
  const sn = args.serial_number.trim().replace(/[^0-9]/g, '')
  if (sn.length < 7 || sn.length > 8) throw new Error('serial_number must be 7-8 digits')
  const data = await usptoFetch<{ response: { docs: Array<Record<string, unknown>> } }>(`/oa_citations/v2/citations?searchText=${sn}&rows=1`)
  if (!data.response?.docs?.length) throw new Error('Trademark not found')
  const d = data.response.docs[0]
  return {
    serialNumber: sn,
    markText: d.markIdentification || d.citedMarkOwnerName || null,
    status: d.markCurrentStatusExternalDescriptionText || null,
    filingDate: d.applicationDate || null,
    registrationNumber: d.registrationNumber || null,
    owner: d.citedMarkOwnerName || d.ownerName || null,
    internationalClass: d.internationalClassDescriptionText || null,
  }
}, { method: 'get_trademark_status' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchTrademarks, getTrademarkStatus }

console.log('settlegrid-trademark-search MCP server ready')
console.log('Methods: search_trademarks, get_trademark_status')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
