/**
 * settlegrid-doaj — DOAJ Open Access Journals MCP Server
 * Wraps DOAJ API with SettleGrid billing.
 *
 * The Directory of Open Access Journals indexes quality-controlled
 * open access journals and articles across all disciplines.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface DoajArticle {
  id: string
  bibjson: {
    title: string
    abstract: string | null
    author: { name: string }[]
    journal: { title: string; issns: string[] }
    year: string | null
    link: { url: string; type: string }[]
    identifier: { id: string; type: string }[]
  }
}

interface DoajJournal {
  id: string
  bibjson: {
    title: string
    publisher: { name: string }
    issns: string[]
    subject: { term: string; scheme: string }[]
    apc: { has_apc: boolean }
    language: string[]
  }
}

interface DoajSearchResult<T> {
  total: number
  page: number
  pageSize: number
  results: T[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://doaj.org/api'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

function validateISSN(issn: string): string {
  const clean = issn.trim()
  if (!/^\d{4}-?\d{3}[\dXx]$/.test(clean)) {
    throw new Error(`Invalid ISSN format: ${issn}. Expected format: 1234-5678`)
  }
  return clean
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'doaj' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchArticles(query: string, limit?: number): Promise<DoajSearchResult<DoajArticle>> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 100, 10)
  return sg.wrap('search_articles', async () => {
    return apiFetch<DoajSearchResult<DoajArticle>>(`/search/articles/${q}?pageSize=${l}`)
  })
}

async function searchJournals(query: string, limit?: number): Promise<DoajSearchResult<DoajJournal>> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 100, 10)
  return sg.wrap('search_journals', async () => {
    return apiFetch<DoajSearchResult<DoajJournal>>(`/search/journals/${q}?pageSize=${l}`)
  })
}

async function getJournal(issn: string): Promise<DoajJournal> {
  const validIssn = validateISSN(issn)
  return sg.wrap('get_journal', async () => {
    const result = await apiFetch<DoajSearchResult<DoajJournal>>(
      `/search/journals/issn:${validIssn}`
    )
    if (!result.results.length) throw new Error(`No journal found with ISSN: ${validIssn}`)
    return result.results[0]
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchArticles, searchJournals, getJournal }
export type { DoajArticle, DoajJournal, DoajSearchResult }
console.log('settlegrid-doaj server started')
