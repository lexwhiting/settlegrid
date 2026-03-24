/**
 * settlegrid-product-hunt — Product Hunt MCP Server
 *
 * Wraps the Product Hunt API with SettleGrid billing.
 * Requires PRODUCTHUNT_TOKEN environment variable.
 *
 * Methods:
 *   get_posts()                              (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetPostsInput {
  order?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.producthunt.com/v2/api'
const USER_AGENT = 'settlegrid-product-hunt/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.PRODUCTHUNT_TOKEN
  if (!key) throw new Error('PRODUCTHUNT_TOKEN environment variable is required')
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
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    Authorization: `Bearer ${getApiKey()}`,
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
    throw new Error(`Product Hunt API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'product-hunt',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_posts: { costCents: 2, displayName: 'Get today's featured products' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPosts = sg.wrap(async (args: GetPostsInput) => {

  const body: Record<string, unknown> = {}
  if (args.order !== undefined) body['order'] = args.order

  const data = await apiFetch<Record<string, unknown>>('/graphql', {
    method: 'POST',
    body,
  })

  return data
}, { method: 'get_posts' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPosts }

console.log('settlegrid-product-hunt MCP server ready')
console.log('Methods: get_posts')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
