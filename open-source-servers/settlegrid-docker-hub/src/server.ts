/**
 * settlegrid-docker-hub — Docker Hub MCP Server
 *
 * Wraps the Docker Hub API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search(query)                            (1¢)
 *   get_tags(namespace, repository)          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  page_size?: number
}

interface GetTagsInput {
  namespace: string
  repository: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://hub.docker.com/v2'
const USER_AGENT = 'settlegrid-docker-hub/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Docker Hub API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'docker-hub',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search: { costCents: 1, displayName: 'Search Docker images' },
      get_tags: { costCents: 1, displayName: 'Get image tags for a repository' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search query)')
  }

  const params: Record<string, string> = {}
  params['query'] = args.query
  if (args.page_size !== undefined) params['page_size'] = String(args.page_size)

  const data = await apiFetch<Record<string, unknown>>('/search/repositories/', {
    params,
  })

  return data
}, { method: 'search' })

const getTags = sg.wrap(async (args: GetTagsInput) => {
  if (!args.namespace || typeof args.namespace !== 'string') {
    throw new Error('namespace is required (namespace (e.g. library))')
  }
  if (!args.repository || typeof args.repository !== 'string') {
    throw new Error('repository is required (repository name (e.g. node))')
  }

  const params: Record<string, string> = {}
  params['namespace'] = String(args.namespace)
  params['repository'] = String(args.repository)

  const data = await apiFetch<Record<string, unknown>>(`/repositories/${encodeURIComponent(String(args.namespace))}/${encodeURIComponent(String(args.repository))}/tags/`, {
    params,
  })

  return data
}, { method: 'get_tags' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { search, getTags }

console.log('settlegrid-docker-hub MCP server ready')
console.log('Methods: search, get_tags')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
