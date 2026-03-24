/**
 * settlegrid-altmetric — Altmetric Research Impact MCP Server
 * Wraps Altmetric API with SettleGrid billing.
 *
 * Altmetric tracks the online attention that research outputs receive,
 * including mentions in news, social media, policy documents, and more.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface AltmetricArticle {
  altmetric_id: number
  doi: string
  title: string
  score: number
  cited_by_tweeters_count: number
  cited_by_fbwalls_count: number
  cited_by_feeds_count: number
  cited_by_policies_count: number
  cited_by_msm_count: number
  cited_by_wikipedia_count: number
  cited_by_posts_count: number
  details_url: string
  published_on: number | null
  journal: string | null
  authors: string[]
  subjects: string[]
}

interface AltmetricCitations {
  doi: string
  score: number
  twitter: number
  facebook: number
  news: number
  blogs: number
  policy: number
  wikipedia: number
  reddit: number
  total_posts: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.altmetric.com/v1'
const API_KEY = process.env.ALTMETRIC_API_KEY || ''

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const sep = url.includes('?') ? '&' : '?'
  const keyParam = API_KEY ? `${sep}key=${API_KEY}` : ''
  const res = await fetch(`${url}${keyParam}`, {
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function validateDoi(doi: string): string {
  const clean = doi.trim().replace(/^https?:\/\/doi\.org\//, '')
  if (!clean.startsWith('10.')) throw new Error(`Invalid DOI: ${doi}. Must start with 10.`)
  return clean
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'altmetric' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getArticle(doi: string): Promise<AltmetricArticle> {
  const cleanDoi = validateDoi(doi)
  return sg.wrap('get_article', async () => {
    return apiFetch<AltmetricArticle>(`/doi/${cleanDoi}`)
  })
}

async function getCitations(doi: string): Promise<AltmetricCitations> {
  const cleanDoi = validateDoi(doi)
  return sg.wrap('get_citations', async () => {
    const data = await apiFetch<any>(`/doi/${cleanDoi}`)
    return {
      doi: cleanDoi,
      score: data.score || 0,
      twitter: data.cited_by_tweeters_count || 0,
      facebook: data.cited_by_fbwalls_count || 0,
      news: data.cited_by_msm_count || 0,
      blogs: data.cited_by_feeds_count || 0,
      policy: data.cited_by_policies_count || 0,
      wikipedia: data.cited_by_wikipedia_count || 0,
      reddit: data.cited_by_rdts_count || 0,
      total_posts: data.cited_by_posts_count || 0,
    }
  })
}

async function searchArticles(query: string): Promise<{ results: AltmetricArticle[] }> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  return sg.wrap('search_articles', async () => {
    const q = encodeURIComponent(query.trim())
    const data = await apiFetch<any>(`/citations/1d?q=${q}&num_results=10`)
    return { results: data.results || [] }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getArticle, getCitations, searchArticles }
export type { AltmetricArticle, AltmetricCitations }
console.log('settlegrid-altmetric server started')
