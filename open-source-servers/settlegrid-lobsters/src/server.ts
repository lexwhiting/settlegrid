/**
 * settlegrid-lobsters — Lobsters MCP Server
 *
 * Wraps the Lobsters API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_hottest()                            (1¢)
 *   get_newest()                             (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetHottestInput {
}

interface GetNewestInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://lobste.rs'
const USER_AGENT = 'settlegrid-lobsters/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Lobsters API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'lobsters',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_hottest: { costCents: 1, displayName: 'Get hottest stories' },
      get_newest: { costCents: 1, displayName: 'Get newest stories' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getHottest = sg.wrap(async (args: GetHottestInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/hottest.json', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 25) : [data]

  return { count: items.length, results: items }
}, { method: 'get_hottest' })

const getNewest = sg.wrap(async (args: GetNewestInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/newest.json', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 25) : [data]

  return { count: items.length, results: items }
}, { method: 'get_newest' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getHottest, getNewest }

console.log('settlegrid-lobsters MCP server ready')
console.log('Methods: get_hottest, get_newest')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
