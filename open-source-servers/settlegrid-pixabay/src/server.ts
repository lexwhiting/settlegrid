/**
 * settlegrid-pixabay — Pixabay Images & Videos MCP Server
 *
 * Wraps the Pixabay API with SettleGrid billing.
 * Requires a free Pixabay API key.
 *
 * Methods:
 *   search_images(query, per_page)  — Search images   (2¢)
 *   search_videos(query, per_page)  — Search videos   (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  per_page?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const PIX_BASE = 'https://pixabay.com/api'
const API_KEY = process.env.PIXABAY_API_KEY || ''

async function pixFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('PIXABAY_API_KEY environment variable is required')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${PIX_BASE}${path}${sep}key=${API_KEY}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Pixabay API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'pixabay',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_images: { costCents: 2, displayName: 'Search Images' },
      search_videos: { costCents: 2, displayName: 'Search Videos' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchImages = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const perPage = Math.min(Math.max(args.per_page ?? 10, 3), 20)
  const q = encodeURIComponent(args.query)
  const data = await pixFetch<{ totalHits: number; hits: any[] }>(
    `/?q=${q}&per_page=${perPage}&safesearch=true`
  )
  return {
    query: args.query,
    totalHits: data.totalHits,
    images: data.hits.map((h: any) => ({
      id: h.id,
      tags: h.tags,
      previewUrl: h.previewURL,
      webformatUrl: h.webformatURL,
      largeImageUrl: h.largeImageURL,
      imageWidth: h.imageWidth,
      imageHeight: h.imageHeight,
      views: h.views,
      downloads: h.downloads,
      likes: h.likes,
      user: h.user,
    })),
  }
}, { method: 'search_images' })

const searchVideos = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const perPage = Math.min(Math.max(args.per_page ?? 10, 3), 20)
  const q = encodeURIComponent(args.query)
  const data = await pixFetch<{ totalHits: number; hits: any[] }>(
    `/videos/?q=${q}&per_page=${perPage}&safesearch=true`
  )
  return {
    query: args.query,
    totalHits: data.totalHits,
    videos: data.hits.map((h: any) => ({
      id: h.id,
      tags: h.tags,
      duration: h.duration,
      previewUrl: h.videos?.tiny?.url,
      fullUrl: h.videos?.medium?.url,
      views: h.views,
      downloads: h.downloads,
      likes: h.likes,
      user: h.user,
    })),
  }
}, { method: 'search_videos' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchImages, searchVideos }

console.log('settlegrid-pixabay MCP server ready')
console.log('Methods: search_images, search_videos')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
