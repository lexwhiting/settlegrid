/**
 * settlegrid-stack-exchange — Stack Exchange MCP Server
 *
 * Wraps the Stack Exchange API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search(q)                                (1¢)
 *   get_answers(id)                          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  q: string
  site?: string
  pagesize?: number
}

interface GetAnswersInput {
  id: number
  site?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.stackexchange.com/2.3'
const USER_AGENT = 'settlegrid-stack-exchange/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Stack Exchange API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'stack-exchange',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search: { costCents: 1, displayName: 'Search questions across Stack Exchange sites' },
      get_answers: { costCents: 1, displayName: 'Get answers for a question by ID' },
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
  if (args.site !== undefined) params['site'] = String(args.site)
  if (args.pagesize !== undefined) params['pagesize'] = String(args.pagesize)

  const data = await apiFetch<Record<string, unknown>>('/search/advanced', {
    params,
  })

  return data
}, { method: 'search' })

const getAnswers = sg.wrap(async (args: GetAnswersInput) => {
  if (typeof args.id !== 'number' || isNaN(args.id)) {
    throw new Error('id must be a number')
  }

  const params: Record<string, string> = {}
  if (args.site !== undefined) params['site'] = String(args.site)

  const data = await apiFetch<Record<string, unknown>>(`/questions/${encodeURIComponent(String(args.id))}/answers`, {
    params,
  })

  return data
}, { method: 'get_answers' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { search, getAnswers }

console.log('settlegrid-stack-exchange MCP server ready')
console.log('Methods: search, get_answers')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
