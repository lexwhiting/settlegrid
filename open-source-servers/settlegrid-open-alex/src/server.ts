/**
 * settlegrid-open-alex — OpenAlex Academic Metadata MCP Server
 *
 * Wraps the OpenAlex API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_works(query, per_page)    — Search works         (1¢)
 *   get_author(author_id)            — Get author profile   (1¢)
 *   search_institutions(query)       — Search institutions  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchWorksInput {
  query: string
  per_page?: number
}

interface AuthorInput {
  author_id: string
}

interface InstitutionInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const OA_BASE = 'https://api.openalex.org'
const MAILTO = 'mailto=contact@settlegrid.ai'

async function oaFetch<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${OA_BASE}${path}${sep}${MAILTO}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenAlex API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'open-alex',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_works: { costCents: 1, displayName: 'Search Works' },
      get_author: { costCents: 1, displayName: 'Get Author' },
      search_institutions: { costCents: 1, displayName: 'Search Institutions' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchWorks = sg.wrap(async (args: SearchWorksInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const perPage = Math.min(Math.max(args.per_page ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await oaFetch<{ meta: { count: number }; results: any[] }>(
    `/works?search=${q}&per_page=${perPage}`
  )
  return {
    query: args.query,
    totalCount: data.meta.count,
    works: data.results.map((w: any) => ({
      id: w.id,
      doi: w.doi,
      title: w.title,
      publicationYear: w.publication_year,
      citedByCount: w.cited_by_count,
      type: w.type,
      authors: w.authorships?.slice(0, 5).map((a: any) => a.author?.display_name) || [],
    })),
  }
}, { method: 'search_works' })

const getAuthor = sg.wrap(async (args: AuthorInput) => {
  if (!args.author_id || typeof args.author_id !== 'string') {
    throw new Error('author_id is required (e.g. "A5023888391")')
  }
  const data = await oaFetch<any>(`/authors/${encodeURIComponent(args.author_id)}`)
  return {
    id: data.id,
    displayName: data.display_name,
    worksCount: data.works_count,
    citedByCount: data.cited_by_count,
    hIndex: data.summary_stats?.h_index,
    institution: data.last_known_institution?.display_name,
    topics: data.topics?.slice(0, 5).map((t: any) => t.display_name) || [],
  }
}, { method: 'get_author' })

const searchInstitutions = sg.wrap(async (args: InstitutionInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query)
  const data = await oaFetch<{ results: any[] }>(`/institutions?search=${q}&per_page=10`)
  return {
    query: args.query,
    institutions: data.results.map((i: any) => ({
      id: i.id,
      displayName: i.display_name,
      country: i.country_code,
      type: i.type,
      worksCount: i.works_count,
      citedByCount: i.cited_by_count,
      homepageUrl: i.homepage_url,
    })),
  }
}, { method: 'search_institutions' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchWorks, getAuthor, searchInstitutions }

console.log('settlegrid-open-alex MCP server ready')
console.log('Methods: search_works, get_author, search_institutions')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
