/**
 * settlegrid-bitbucket — Bitbucket MCP Server
 *
 * Wraps the Bitbucket API with SettleGrid billing.
 * Requires BITBUCKET_TOKEN environment variable.
 *
 * Methods:
 *   search_repos(q)                          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchReposInput {
  q: string
  pagelen?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.bitbucket.org/2.0'
const USER_AGENT = 'settlegrid-bitbucket/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.BITBUCKET_TOKEN
  if (!key) throw new Error('BITBUCKET_TOKEN environment variable is required')
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
    throw new Error(`Bitbucket API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bitbucket',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_repos: { costCents: 1, displayName: 'Search public repositories' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchRepos = sg.wrap(async (args: SearchReposInput) => {
  if (!args.q || typeof args.q !== 'string') {
    throw new Error('q is required (search query)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.q
  if (args.pagelen !== undefined) params['pagelen'] = String(args.pagelen)

  const data = await apiFetch<Record<string, unknown>>('/repositories', {
    params,
  })

  return data
}, { method: 'search_repos' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchRepos }

console.log('settlegrid-bitbucket MCP server ready')
console.log('Methods: search_repos')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
