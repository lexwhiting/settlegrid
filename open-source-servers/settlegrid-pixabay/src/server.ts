/**
 * settlegrid-pixabay — Pixabay MCP Server
 *
 * Wraps the Pixabay API with SettleGrid billing.
 * Requires PIXABAY_API_KEY environment variable.
 *
 * Methods:
 *   search(q)                                (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  q: string
  image_type?: string
  per_page?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://pixabay.com/api'
const USER_AGENT = 'settlegrid-pixabay/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.PIXABAY_API_KEY
  if (!key) throw new Error('PIXABAY_API_KEY environment variable is required')
  return key
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
  url.searchParams.set('key', getApiKey())
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
    throw new Error(`Pixabay API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'pixabay',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search: { costCents: 1, displayName: 'Search for images' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.q || typeof args.q !== 'string') {
    throw new Error('q is required (search query)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.q
  if (args.image_type !== undefined) params['image_type'] = String(args.image_type)
  if (args.per_page !== undefined) params['per_page'] = String(args.per_page)

  const data = await apiFetch<Record<string, unknown>>('/', {
    params,
  })

  return data
}, { method: 'search' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { search }

console.log('settlegrid-pixabay MCP server ready')
console.log('Methods: search')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
