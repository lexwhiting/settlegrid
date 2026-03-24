/**
 * settlegrid-pexels-photos — Pexels Photos MCP Server
 *
 * Wraps Pexels API with SettleGrid billing.
 * Free key from https://www.pexels.com/api/.
 *
 * Methods:
 *   search_pexels(query, limit?) — search photos (2¢)
 *   get_curated(limit?) — curated photos (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number }
interface CuratedInput { limit?: number }

const API_BASE = 'https://api.pexels.com/v1'
const API_KEY = process.env.PEXELS_API_KEY || ''

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, { headers: { 'Authorization': API_KEY } })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'pexels-photos',
  pricing: { defaultCostCents: 2, methods: { search_pexels: { costCents: 2, displayName: 'Search Photos' }, get_curated: { costCents: 2, displayName: 'Curated Photos' } } },
})

const searchPexels = sg.wrap(async (args: SearchInput) => {
  if (!API_KEY) throw new Error('PEXELS_API_KEY not set')
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 15
  const data = await apiFetch<any>(`/search?query=${encodeURIComponent(args.query)}&per_page=${limit}`)
  return {
    total: data.total_results,
    photos: (data.photos || []).map((p: any) => ({
      id: p.id, photographer: p.photographer, alt: p.alt,
      width: p.width, height: p.height,
      src: { original: p.src?.original, medium: p.src?.medium, small: p.src?.small },
      url: p.url,
    })),
  }
}, { method: 'search_pexels' })

const getCurated = sg.wrap(async (args: CuratedInput) => {
  if (!API_KEY) throw new Error('PEXELS_API_KEY not set')
  const limit = args.limit ?? 15
  const data = await apiFetch<any>(`/curated?per_page=${limit}`)
  return {
    photos: (data.photos || []).map((p: any) => ({
      id: p.id, photographer: p.photographer, alt: p.alt,
      src: { medium: p.src?.medium, small: p.src?.small },
    })),
  }
}, { method: 'get_curated' })

export { searchPexels, getCurated }

console.log('settlegrid-pexels-photos MCP server ready')
console.log('Methods: search_pexels, get_curated')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
