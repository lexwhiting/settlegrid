/**
 * settlegrid-hashnode — Hashnode MCP Server
 *
 * Wraps the Hashnode API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_feed()                               (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetFeedInput {
  first?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://gql.hashnode.com'
const USER_AGENT = 'settlegrid-hashnode/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Hashnode API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'hashnode',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_feed: { costCents: 1, displayName: 'Get featured articles from Hashnode' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getFeed = sg.wrap(async (args: GetFeedInput) => {

  const body: Record<string, unknown> = {}
  if (args.first !== undefined) body['first'] = args.first

  const data = await apiFetch<Record<string, unknown>>('', {
    method: 'POST',
    body,
  })

  return data
}, { method: 'get_feed' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getFeed }

console.log('settlegrid-hashnode MCP server ready')
console.log('Methods: get_feed')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
