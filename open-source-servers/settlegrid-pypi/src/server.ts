/**
 * settlegrid-pypi — PyPI MCP Server
 *
 * Wraps the PyPI API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_package(name)                        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetPackageInput {
  name: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://pypi.org'
const USER_AGENT = 'settlegrid-pypi/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`PyPI API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'pypi',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_package: { costCents: 1, displayName: 'Get Python package info' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPackage = sg.wrap(async (args: GetPackageInput) => {
  if (!args.name || typeof args.name !== 'string') {
    throw new Error('name is required (package name (e.g. requests, flask))')
  }

  const params: Record<string, string> = {}
  params['name'] = String(args.name)

  const data = await apiFetch<Record<string, unknown>>(`/pypi/${encodeURIComponent(String(args.name))}/json`, {
    params,
  })

  return data
}, { method: 'get_package' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPackage }

console.log('settlegrid-pypi MCP server ready')
console.log('Methods: get_package')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
