/**
 * settlegrid-picsum-photos — Lorem Picsum Photos MCP Server
 *
 * Wraps Lorem Picsum API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_random_photo(width?, height?) — random photo (1¢)
 *   list_photos(page?, limit?) — list photos (1¢)
 *   get_photo_info(id) — photo details (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface PhotoInput { width?: number; height?: number }
interface ListInput { page?: number; limit?: number }
interface InfoInput { id: string }

const API_BASE = 'https://picsum.photos'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'picsum-photos',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_random_photo: { costCents: 1, displayName: 'Random Photo' },
      list_photos: { costCents: 1, displayName: 'List Photos' },
      get_photo_info: { costCents: 1, displayName: 'Photo Info' },
    },
  },
})

const getRandomPhoto = sg.wrap(async (args: PhotoInput) => {
  const w = args.width ?? 800
  const h = args.height ?? 600
  return {
    url: `${API_BASE}/${w}/${h}`,
    grayscale_url: `${API_BASE}/${w}/${h}?grayscale`,
    blur_url: `${API_BASE}/${w}/${h}?blur=5`,
    width: w, height: h,
  }
}, { method: 'get_random_photo' })

const listPhotos = sg.wrap(async (args: ListInput) => {
  const page = args.page ?? 1
  const limit = args.limit ?? 20
  const data = await apiFetch<any[]>(`/v2/list?page=${page}&limit=${limit}`)
  return {
    photos: data.map((p: any) => ({
      id: p.id, author: p.author, width: p.width, height: p.height,
      url: p.url, download_url: p.download_url,
    })),
  }
}, { method: 'list_photos' })

const getPhotoInfo = sg.wrap(async (args: InfoInput) => {
  if (!args.id) throw new Error('id is required')
  const data = await apiFetch<any>(`/id/${args.id}/info`)
  return {
    id: data.id, author: data.author, width: data.width, height: data.height,
    url: data.url, download_url: data.download_url,
  }
}, { method: 'get_photo_info' })

export { getRandomPhoto, listPhotos, getPhotoInfo }

console.log('settlegrid-picsum-photos MCP server ready')
console.log('Methods: get_random_photo, list_photos, get_photo_info')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
