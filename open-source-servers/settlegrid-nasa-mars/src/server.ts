/**
 * settlegrid-nasa-mars — NASA Mars Rover Photos MCP Server
 *
 * Wraps the NASA Mars Rover Photos API with SettleGrid billing.
 * Requires NASA_API_KEY environment variable.
 *
 * Methods:
 *   get_photos(rover, sol)                   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetPhotosInput {
  rover: string
  sol: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.nasa.gov'
const USER_AGENT = 'settlegrid-nasa-mars/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  return process.env.NASA_API_KEY ?? 'DEMO_KEY'
}

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
  url.searchParams.set('api_key', getApiKey())
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
    throw new Error(`NASA Mars Rover Photos API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nasa-mars',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_photos: { costCents: 1, displayName: 'Get Mars rover photos by sol or date' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPhotos = sg.wrap(async (args: GetPhotosInput) => {
  if (!args.rover || typeof args.rover !== 'string') {
    throw new Error('rover is required (rover name: curiosity, opportunity, spirit)')
  }
  if (typeof args.sol !== 'number' || isNaN(args.sol)) {
    throw new Error('sol must be a number')
  }

  const params: Record<string, string> = {}
  params['sol'] = String(args.sol)

  const data = await apiFetch<Record<string, unknown>>(`/mars-photos/api/v1/rovers/${encodeURIComponent(String(args.rover))}/photos`, {
    params,
  })

  return data
}, { method: 'get_photos' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPhotos }

console.log('settlegrid-nasa-mars MCP server ready')
console.log('Methods: get_photos')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
