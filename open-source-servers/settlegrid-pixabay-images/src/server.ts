/**
 * settlegrid-pixabay-images — Pixabay Images MCP Server
 *
 * Wraps Pixabay API with SettleGrid billing.
 * Free key from https://pixabay.com/api/docs/.
 *
 * Methods:
 *   search_images(query, limit?) — search images (2¢)
 *   search_videos(query, limit?) — search videos (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number }

const API_KEY = process.env.PIXABAY_API_KEY || ''

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'pixabay-images',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_images: { costCents: 2, displayName: 'Search Images' },
      search_videos: { costCents: 2, displayName: 'Search Videos' },
    },
  },
})

const searchImages = sg.wrap(async (args: SearchInput) => {
  if (!API_KEY) throw new Error('PIXABAY_API_KEY not set')
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 20
  const data = await apiFetch<any>(`https://pixabay.com/api/?key=${API_KEY}&q=${encodeURIComponent(args.query)}&per_page=${limit}&image_type=photo`)
  return {
    total: data.totalHits,
    images: (data.hits || []).map((h: any) => ({
      id: h.id, tags: h.tags, preview: h.previewURL, web: h.webformatURL,
      large: h.largeImageURL, views: h.views, downloads: h.downloads,
      likes: h.likes, user: h.user, width: h.imageWidth, height: h.imageHeight,
    })),
  }
}, { method: 'search_images' })

const searchVideos = sg.wrap(async (args: SearchInput) => {
  if (!API_KEY) throw new Error('PIXABAY_API_KEY not set')
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 20
  const data = await apiFetch<any>(`https://pixabay.com/api/videos/?key=${API_KEY}&q=${encodeURIComponent(args.query)}&per_page=${limit}`)
  return {
    total: data.totalHits,
    videos: (data.hits || []).map((h: any) => ({
      id: h.id, tags: h.tags, duration: h.duration, views: h.views,
      downloads: h.downloads, likes: h.likes, user: h.user,
      videos: { small: h.videos?.small?.url, medium: h.videos?.medium?.url },
    })),
  }
}, { method: 'search_videos' })

export { searchImages, searchVideos }

console.log('settlegrid-pixabay-images MCP server ready')
console.log('Methods: search_images, search_videos')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
