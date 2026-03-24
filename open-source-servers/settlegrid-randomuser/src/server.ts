/**
 * settlegrid-randomuser — Random User MCP Server
 *
 * Wraps the Random User API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   generate()                               (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GenerateInput {
  results?: number
  nat?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://randomuser.me/api'
const USER_AGENT = 'settlegrid-randomuser/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Random User API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'randomuser',
  pricing: {
    defaultCostCents: 1,
    methods: {
      generate: { costCents: 1, displayName: 'Generate random user profiles' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const generate = sg.wrap(async (args: GenerateInput) => {

  const params: Record<string, string> = {}
  if (args.results !== undefined) params['results'] = String(args.results)
  if (args.nat !== undefined) params['nat'] = String(args.nat)

  const data = await apiFetch<Record<string, unknown>>('', {
    params,
  })

  return data
}, { method: 'generate' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { generate }

console.log('settlegrid-randomuser MCP server ready')
console.log('Methods: generate')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
