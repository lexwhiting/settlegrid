/**
 * settlegrid-wikipedia — Wikipedia MCP Server
 *
 * Wraps the free MediaWiki/Wikipedia REST API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_summary(title)        — Article summary with extract    (1¢)
 *   search(query)             — Search Wikipedia articles       (1¢)
 *   get_random()              — Random featured article         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetSummaryInput {
  title: string
  lang?: string
}

interface SearchInput {
  query: string
  limit?: number
  lang?: string
}

interface GetRandomInput {
  lang?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const USER_AGENT = 'settlegrid-wikipedia/1.0 (contact@settlegrid.ai)'

const SUPPORTED_LANGS = new Set([
  'en', 'es', 'fr', 'de', 'ja', 'zh', 'ru', 'pt', 'it', 'ar',
  'ko', 'nl', 'pl', 'sv', 'uk', 'vi', 'he', 'id', 'tr', 'cs',
])

function getLang(lang?: string): string {
  const l = (lang ?? 'en').toLowerCase().trim()
  if (!SUPPORTED_LANGS.has(l)) {
    throw new Error(`Unsupported language "${lang}". Supported: ${[...SUPPORTED_LANGS].join(', ')}`)
  }
  return l
}

async function wikiRestFetch<T>(lang: string, path: string): Promise<T> {
  const url = `https://${lang}.wikipedia.org/api/rest_v1${path}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  })
  if (res.status === 404) {
    throw new Error('Article not found. Check the title and try again.')
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Wikipedia API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

async function wikiActionFetch<T>(lang: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('origin', '*')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Wikipedia API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'wikipedia',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_summary: { costCents: 1, displayName: 'Article Summary' },
      search: { costCents: 1, displayName: 'Search Articles' },
      get_random: { costCents: 1, displayName: 'Random Article' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSummary = sg.wrap(async (args: GetSummaryInput) => {
  if (!args.title || typeof args.title !== 'string') {
    throw new Error('title is required (e.g. "Albert Einstein", "Photosynthesis")')
  }
  const lang = getLang(args.lang)
  const title = encodeURIComponent(args.title.trim().replace(/ /g, '_'))

  const data = await wikiRestFetch<{
    title: string
    displaytitle: string
    description?: string
    extract: string
    extract_html: string
    content_urls: {
      desktop: { page: string }
      mobile: { page: string }
    }
    thumbnail?: { source: string; width: number; height: number }
    timestamp: string
    lang: string
  }>(lang, `/page/summary/${title}`)

  return {
    title: data.title,
    displayTitle: data.displaytitle,
    description: data.description ?? null,
    extract: data.extract,
    url: data.content_urls.desktop.page,
    mobileUrl: data.content_urls.mobile.page,
    thumbnail: data.thumbnail
      ? { url: data.thumbnail.source, width: data.thumbnail.width, height: data.thumbnail.height }
      : null,
    lastModified: data.timestamp,
    language: lang,
  }
}, { method: 'get_summary' })

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (e.g. "machine learning", "climate change")')
  }
  const lang = getLang(args.lang)
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 50)

  const data = await wikiActionFetch<{
    query?: {
      search: Array<{
        title: string
        pageid: number
        snippet: string
        size: number
        wordcount: number
        timestamp: string
      }>
      searchinfo: { totalhits: number }
    }
  }>(lang, {
    action: 'query',
    list: 'search',
    srsearch: args.query.trim(),
    srlimit: String(limit),
    srprop: 'snippet|size|wordcount|timestamp',
  })

  const results = data.query?.search ?? []

  return {
    query: args.query,
    language: lang,
    totalHits: data.query?.searchinfo?.totalhits ?? 0,
    results: results.map((r) => ({
      title: r.title,
      pageId: r.pageid,
      snippet: r.snippet.replace(/<\/?span[^>]*>/g, ''),
      wordCount: r.wordcount,
      lastModified: r.timestamp,
      url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
    })),
  }
}, { method: 'search' })

const getRandom = sg.wrap(async (args: GetRandomInput) => {
  const lang = getLang(args.lang)

  const data = await wikiRestFetch<{
    title: string
    displaytitle: string
    description?: string
    extract: string
    content_urls: {
      desktop: { page: string }
      mobile: { page: string }
    }
    thumbnail?: { source: string; width: number; height: number }
    timestamp: string
  }>(lang, '/page/random/summary')

  return {
    title: data.title,
    displayTitle: data.displaytitle,
    description: data.description ?? null,
    extract: data.extract,
    url: data.content_urls.desktop.page,
    thumbnail: data.thumbnail
      ? { url: data.thumbnail.source, width: data.thumbnail.width, height: data.thumbnail.height }
      : null,
    lastModified: data.timestamp,
    language: lang,
  }
}, { method: 'get_random' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSummary, search, getRandom }

// ─── REST Alternative (uncomment to serve as HTTP) ──────────────────────────
//
// import { settlegridMiddleware } from '@settlegrid/mcp'
// const middleware = settlegridMiddleware({
//   toolSlug: 'wikipedia',
//   pricing: { defaultCostCents: 1 },
//   routes: { ... },
// })

console.log('settlegrid-wikipedia MCP server ready')
console.log('Methods: get_summary, search, get_random')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
