/**
 * settlegrid-npm-registry — npm Registry MCP Server
 *
 * Wraps the npm Registry API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_package(name)                        (1¢)
 *   search(text)                             (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetPackageInput {
  name: string
}

interface SearchInput {
  text: string
  size?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://registry.npmjs.org'
const USER_AGENT = 'settlegrid-npm-registry/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`npm Registry API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'npm-registry',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_package: { costCents: 1, displayName: 'Get package metadata' },
      search: { costCents: 1, displayName: 'Search npm packages' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPackage = sg.wrap(async (args: GetPackageInput) => {
  if (!args.name || typeof args.name !== 'string') {
    throw new Error('name is required (package name (e.g. react, express))')
  }

  const params: Record<string, string> = {}
  params['name'] = String(args.name)

  const data = await apiFetch<Record<string, unknown>>(`/${encodeURIComponent(String(args.name))}`, {
    params,
  })

  return data
}, { method: 'get_package' })

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.text || typeof args.text !== 'string') {
    throw new Error('text is required (search query)')
  }

  const params: Record<string, string> = {}
  params['text'] = args.text
  if (args.size !== undefined) params['size'] = String(args.size)

  const data = await apiFetch<Record<string, unknown>>('/-/v1/search', {
    params,
  })

  return data
}, { method: 'search' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPackage, search }

console.log('settlegrid-npm-registry MCP server ready')
console.log('Methods: get_package, search')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
