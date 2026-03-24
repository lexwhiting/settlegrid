/**
 * settlegrid-flickr — Flickr Photo Search MCP Server
 *
 * Search and explore photos on Flickr. Requires free Flickr API key.
 *
 * Methods:
 *   search_photos(query, page?, perPage?) — Search photos (1¢)
 *   get_photo_info(photoId) — Get photo details (1¢)
 *   get_interesting() — Get today's interesting photos (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; page?: number; perPage?: number }
interface PhotoInput { photoId: string }

let _apiKey: string | undefined
function getApiKey(): string {
  if (!_apiKey) _apiKey = process.env.FLICKR_API_KEY
  if (!_apiKey) throw new Error('FLICKR_API_KEY env var required')
  return _apiKey
}

const API = 'https://api.flickr.com/services/rest'

async function flickrFetch(method: string, params: Record<string, string> = {}): Promise<any> {
  const searchParams = new URLSearchParams({
    method,
    api_key: getApiKey(),
    format: 'json',
    nojsoncallback: '1',
    ...params,
  })
  const res = await fetch(`${API}?${searchParams}`)
  if (!res.ok) throw new Error(`Flickr API ${res.status}`)
  const data = await res.json()
  if (data.stat !== 'ok') throw new Error(`Flickr error: ${data.message || 'unknown'}`)
  return data
}

function photoUrl(photo: any, size = 'z'): string {
  return `https://live.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_${size}.jpg`
}

const sg = settlegrid.init({
  toolSlug: 'flickr',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_photos: { costCents: 1, displayName: 'Search Photos' },
      get_photo_info: { costCents: 1, displayName: 'Photo Info' },
      get_interesting: { costCents: 1, displayName: 'Interesting Photos' },
    },
  },
})

const searchPhotos = sg.wrap(async (args: SearchInput) => {
  const q = args.query?.trim()
  if (!q) throw new Error('query required')
  const data = await flickrFetch('flickr.photos.search', {
    text: q,
    page: String(args.page || 1),
    per_page: String(Math.min(args.perPage || 20, 50)),
    extras: 'description,owner_name,date_taken,views,tags',
    sort: 'relevance',
  })
  const photos = (data.photos?.photo || []).map((p: any) => ({
    id: p.id, title: p.title, owner: p.ownername,
    dateTaken: p.datetaken, views: parseInt(p.views || '0'),
    url: photoUrl(p), tags: p.tags,
  }))
  return { query: q, page: data.photos?.page, pages: data.photos?.pages, total: data.photos?.total, photos }
}, { method: 'search_photos' })

const getPhotoInfo = sg.wrap(async (args: PhotoInput) => {
  if (!args.photoId) throw new Error('photoId required')
  const data = await flickrFetch('flickr.photos.getInfo', { photo_id: args.photoId })
  const p = data.photo
  return {
    id: p.id, title: p.title?._content, description: p.description?._content?.slice(0, 500),
    owner: p.owner?.username, dateTaken: p.dates?.taken,
    views: p.views, tags: p.tags?.tag?.map((t: any) => t.raw) || [],
    url: `https://www.flickr.com/photos/${p.owner?.nsid}/${p.id}`,
  }
}, { method: 'get_photo_info' })

const getInteresting = sg.wrap(async () => {
  const data = await flickrFetch('flickr.interestingness.getList', {
    per_page: '20',
    extras: 'owner_name,views,date_taken',
  })
  const photos = (data.photos?.photo || []).map((p: any) => ({
    id: p.id, title: p.title, owner: p.ownername,
    views: parseInt(p.views || '0'), url: photoUrl(p),
  }))
  return { date: new Date().toISOString().split('T')[0], photos }
}, { method: 'get_interesting' })

export { searchPhotos, getPhotoInfo, getInteresting }

console.log('settlegrid-flickr MCP server ready')
console.log('Methods: search_photos, get_photo_info, get_interesting')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
