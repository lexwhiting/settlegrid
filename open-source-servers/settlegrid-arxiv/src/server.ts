/**
 * settlegrid-arxiv — arXiv Academic Paper Search MCP Server
 *
 * Wraps the arXiv API (export.arxiv.org) with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_papers(query, max_results)  — Search arXiv papers   (1¢)
 *   get_paper(id)                      — Get paper by arXiv ID (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  max_results?: number
}

interface GetPaperInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const ARXIV_BASE = 'https://export.arxiv.org/api/query'

async function arxivFetch(params: string): Promise<string> {
  const res = await fetch(`${ARXIV_BASE}?${params}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`arXiv API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.text()
}

function parseEntries(xml: string): Array<Record<string, string>> {
  const entries: Array<Record<string, string>> = []
  const entryRegex = /<entry>(.*?)<\/entry>/gs
  let match: RegExpExecArray | null
  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1]
    const get = (tag: string): string => {
      const m = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 's').exec(block)
      return m ? m[1].trim() : ''
    }
    entries.push({
      id: get('id'),
      title: get('title').replace(/\s+/g, ' '),
      summary: get('summary').replace(/\s+/g, ' ').slice(0, 500),
      published: get('published'),
      updated: get('updated'),
    })
  }
  return entries
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'arxiv',
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
  const maxResults = Math.min(Math.max(args.max_results ?? 10, 1), 50)
  const q = encodeURIComponent(args.query)
  const xml = await arxivFetch(`search_query=all:${q}&start=0&max_results=${maxResults}`)
  const entries = parseEntries(xml)
  return { query: args.query, count: entries.length, papers: entries }
}, { method: 'search_papers' })

const getPaper = sg.wrap(async (args: GetPaperInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (e.g. "2301.07041")')
  }
  const xml = await arxivFetch(`id_list=${encodeURIComponent(args.id)}`)
  const entries = parseEntries(xml)
  if (entries.length === 0) {
    throw new Error(`Paper not found: ${args.id}`)
  }
  return entries[0]
}, { method: 'get_paper' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPapers, getPaper }

console.log('settlegrid-arxiv MCP server ready')
console.log('Methods: search_papers, get_paper')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
