/**
 * settlegrid-semantic-scholar — Semantic Scholar Research Paper MCP Server
 *
 * Wraps the Semantic Scholar Academic Graph API with SettleGrid billing.
 * Optional API key for higher rate limits.
 *
 * Methods:
 *   search_papers(query, limit)  — Search papers  (1¢)
 *   get_paper(paper_id)          — Get paper details (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface PaperInput {
  paper_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const S2_BASE = 'https://api.semanticscholar.org/graph/v1'
const API_KEY = process.env.S2_API_KEY || ''
const FIELDS = 'title,abstract,year,citationCount,authors,url'

async function s2Fetch<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {}
  if (API_KEY) headers['x-api-key'] = API_KEY
  const res = await fetch(`${S2_BASE}${path}`, { headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Semantic Scholar API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'semantic-scholar',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_papers: { costCents: 1, displayName: 'Search Papers' },
      get_paper: { costCents: 1, displayName: 'Get Paper' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPapers = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await s2Fetch<{ total: number; data: any[] }>(
    `/paper/search?query=${q}&limit=${limit}&fields=${FIELDS}`
  )
  return {
    query: args.query,
    total: data.total,
    papers: data.data.map((p: any) => ({
      paperId: p.paperId,
      title: p.title,
      year: p.year,
      citationCount: p.citationCount,
      authors: p.authors?.map((a: any) => a.name) || [],
      url: p.url,
      abstract: p.abstract?.slice(0, 500),
    })),
  }
}, { method: 'search_papers' })

const getPaper = sg.wrap(async (args: PaperInput) => {
  if (!args.paper_id || typeof args.paper_id !== 'string') {
    throw new Error('paper_id is required (Semantic Scholar ID, DOI, or arXiv ID)')
  }
  const data = await s2Fetch<any>(`/paper/${encodeURIComponent(args.paper_id)}?fields=${FIELDS}`)
  return {
    paperId: data.paperId,
    title: data.title,
    year: data.year,
    citationCount: data.citationCount,
    authors: data.authors?.map((a: any) => a.name) || [],
    url: data.url,
    abstract: data.abstract?.slice(0, 1000),
  }
}, { method: 'get_paper' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPapers, getPaper }

console.log('settlegrid-semantic-scholar MCP server ready')
console.log('Methods: search_papers, get_paper')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
