/**
 * settlegrid-is-it-down — IsItDown MCP Server
 *
 * Wraps the IsItDown API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   check(domain)                            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CheckInput {
  domain: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://isitdown.site/api/v3'
const USER_AGENT = 'settlegrid-is-it-down/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`IsItDown API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'is-it-down',
  pricing: {
    defaultCostCents: 1,
    methods: {
      check: { costCents: 1, displayName: 'Check if a website is down' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const check = sg.wrap(async (args: CheckInput) => {
  if (!args.domain || typeof args.domain !== 'string') {
    throw new Error('domain is required (domain name (e.g. google.com))')
  }

  const params: Record<string, string> = {}
  params['domain'] = String(args.domain)

  const data = await apiFetch<Record<string, unknown>>(`/${encodeURIComponent(String(args.domain))}`, {
    params,
  })

  return data
}, { method: 'check' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { check }

console.log('settlegrid-is-it-down MCP server ready')
console.log('Methods: check')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
