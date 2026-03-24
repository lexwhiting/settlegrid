/**
 * settlegrid-picsum — Lorem Picsum MCP Server
 *
 * Wraps the Lorem Picsum API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   list_images()                            (1¢)
 *   get_image_info(id)                       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListImagesInput {
  page?: number
  limit?: number
}

interface GetImageInfoInput {
  id: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://picsum.photos'
const USER_AGENT = 'settlegrid-picsum/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Lorem Picsum API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'picsum',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_images: { costCents: 1, displayName: 'Get list of available images' },
      get_image_info: { costCents: 1, displayName: 'Get image details by ID' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listImages = sg.wrap(async (args: ListImagesInput) => {

  const params: Record<string, string> = {}
  if (args.page !== undefined) params['page'] = String(args.page)
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/v2/list', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 50) : [data]

  return { count: items.length, results: items }
}, { method: 'list_images' })

const getImageInfo = sg.wrap(async (args: GetImageInfoInput) => {
  if (typeof args.id !== 'number' || isNaN(args.id)) {
    throw new Error('id must be a number')
  }

  const params: Record<string, string> = {}
  params['id'] = String(args.id)

  const data = await apiFetch<Record<string, unknown>>(`/id/${encodeURIComponent(String(args.id))}/info`, {
    params,
  })

  return data
}, { method: 'get_image_info' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listImages, getImageInfo }

console.log('settlegrid-picsum MCP server ready')
console.log('Methods: list_images, get_image_info')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
