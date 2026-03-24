/**
 * settlegrid-guardian — The Guardian MCP Server
 *
 * Search articles from The Guardian newspaper.
 *
 * Methods:
 *   search_articles(q, section)   — Search Guardian articles by keyword  (2¢)
 *   get_article(id)               — Get a Guardian article by ID path  (2¢)
 *   list_sections()               — List available Guardian sections  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchArticlesInput {
  q: string
  section?: string
}

interface GetArticleInput {
  id: string
}

interface ListSectionsInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://content.guardianapis.com'
const API_KEY = process.env.GUARDIAN_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-guardian/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`The Guardian API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'guardian',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_articles: { costCents: 2, displayName: 'Search Articles' },
      get_article: { costCents: 2, displayName: 'Get Article' },
      list_sections: { costCents: 2, displayName: 'List Sections' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchArticles = sg.wrap(async (args: SearchArticlesInput) => {
  if (!args.q || typeof args.q !== 'string') throw new Error('q is required')
  const q = args.q.trim()
  const section = typeof args.section === 'string' ? args.section.trim() : ''
  const data = await apiFetch<any>(`/search?q=${encodeURIComponent(q)}&section=${encodeURIComponent(section)}&page-size=10&api-key=${API_KEY}`)
  const items = (data.response.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        webTitle: item.webTitle,
        webUrl: item.webUrl,
        sectionName: item.sectionName,
        webPublicationDate: item.webPublicationDate,
        type: item.type,
    })),
  }
}, { method: 'search_articles' })

const getArticle = sg.wrap(async (args: GetArticleInput) => {
  if (!args.id || typeof args.id !== 'string') throw new Error('id is required')
  const id = args.id.trim()
  const data = await apiFetch<any>(`/${encodeURIComponent(id)}?show-fields=body,headline,thumbnail&api-key=${API_KEY}`)
  return {
    response: data.response,
  }
}, { method: 'get_article' })

const listSections = sg.wrap(async (args: ListSectionsInput) => {

  const data = await apiFetch<any>(`/sections?api-key=${API_KEY}`)
  const items = (data.response.results ?? []).slice(0, 30)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        webTitle: item.webTitle,
        webUrl: item.webUrl,
    })),
  }
}, { method: 'list_sections' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchArticles, getArticle, listSections }

console.log('settlegrid-guardian MCP server ready')
console.log('Methods: search_articles, get_article, list_sections')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
