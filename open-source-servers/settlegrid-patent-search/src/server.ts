/**
 * settlegrid-patent-search — USPTO Patent Search MCP Server
 *
 * Wraps the USPTO Patent API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_patents(query, rows?)         — Search US patents   (1¢)
 *   get_patent(patent_number)            — Patent details      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string; rows?: number }
interface GetPatentInput { patent_number: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://developer.uspto.gov/ibd-api/v1'
const USER_AGENT = 'settlegrid-patent-search/1.0 (contact@settlegrid.ai)'

async function usptoFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error('Patent not found')
    const body = await res.text().catch(() => '')
    throw new Error(`USPTO API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'patent-search',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_patents: { costCents: 1, displayName: 'Search Patents' },
      get_patent: { costCents: 1, displayName: 'Get Patent' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPatents = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  if (query.length === 0 || query.length > 200) throw new Error('query must be 1-200 characters')
  const rows = Math.min(Math.max(args.rows || 10, 1), 50)
  const data = await usptoFetch<{ response: { numFound: number; docs: Array<Record<string, unknown>> } }>(`/application/publications?searchText=${encodeURIComponent(query)}&rows=${rows}`)
  return {
    query,
    totalFound: data.response.numFound,
    patents: data.response.docs.slice(0, rows).map(d => ({
      patentNumber: d.patentNumber || d.publicationReferenceDocumentNumber,
      title: d.inventionTitle,
      abstract: ((d.abstractText as string[]) || []).join(' ').slice(0, 500),
      inventors: d.inventorNameArrayText || [],
      assignee: d.assigneeEntityName || null,
      filingDate: d.filingDate || null,
      publicationDate: d.publicationDate || null,
    })),
  }
}, { method: 'search_patents' })

const getPatent = sg.wrap(async (args: GetPatentInput) => {
  if (!args.patent_number || typeof args.patent_number !== 'string') throw new Error('patent_number is required')
  const num = args.patent_number.trim().replace(/[^0-9]/g, '')
  if (num.length < 6 || num.length > 11) throw new Error('patent_number must be 6-11 digits')
  const data = await usptoFetch<{ response: { docs: Array<Record<string, unknown>> } }>(`/application/publications?patentNumber=${num}`)
  if (!data.response.docs || data.response.docs.length === 0) throw new Error('Patent not found')
  const d = data.response.docs[0]
  return {
    patentNumber: d.patentNumber || num,
    title: d.inventionTitle,
    abstract: ((d.abstractText as string[]) || []).join(' '),
    inventors: d.inventorNameArrayText || [],
    assignee: d.assigneeEntityName || null,
    filingDate: d.filingDate || null,
    publicationDate: d.publicationDate || null,
    claims: ((d.claimText as string[]) || []).slice(0, 5),
  }
}, { method: 'get_patent' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPatents, getPatent }

console.log('settlegrid-patent-search MCP server ready')
console.log('Methods: search_patents, get_patent')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
