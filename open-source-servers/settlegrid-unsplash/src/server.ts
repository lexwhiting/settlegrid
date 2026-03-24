/**
 * settlegrid-unsplash — Unsplash Photo Search MCP Server
 *
 * Wraps the Unsplash API with SettleGrid billing.
 * Requires a free Unsplash Access Key.
 *
 * Methods:
 *   search_photos(query, per_page)  — Search photos      (2¢)
 *   get_random(query)               — Random photo       (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  per_page?: number
}

interface RandomInput {
  query?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const UNSPLASH_BASE = 'https://api.unsplash.com'
const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || ''

async function unsplashFetch<T>(path: string): Promise<T> {
  if (!ACCESS_KEY) throw new Error('UNSPLASH_ACCESS_KEY environment variable is required')
  const res = await fetch(`${UNSPLASH_BASE}${path}`, {
    headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Unsplash API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatPhoto(p: any): Record<string, unknown> {
  return {
    id: p.id,
    description: p.description || p.alt_description,
    width: p.width,
    height: p.height,
    color: p.color,
    urls: { regular: p.urls?.regular, small: p.urls?.small, thumb: p.urls?.thumb },
    photographer: p.user?.name,
    photographerUrl: p.user?.links?.html,
    likes: p.likes,
    downloadUrl: p.links?.download,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'unsplash',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_photos: { costCents: 2, displayName: 'Search Photos' },
      get_random: { costCents: 2, displayName: 'Random Photo' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPhotos = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const perPage = Math.min(Math.max(args.per_page ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await unsplashFetch<{ total: number; results: any[] }>(
    `/search/photos?query=${q}&per_page=${perPage}`
  )
  return {
    query: args.query,
    total: data.total,
    photos: data.results.map(formatPhoto),
  }
}, { method: 'search_photos' })

const getRandom = sg.wrap(async (args: RandomInput) => {
  let url = '/photos/random'
  if (args.query) url += `?query=${encodeURIComponent(args.query)}`
  const data = await unsplashFetch<any>(url)
  return formatPhoto(data)
}, { method: 'get_random' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPhotos, getRandom }

console.log('settlegrid-unsplash MCP server ready')
console.log('Methods: search_photos, get_random')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
