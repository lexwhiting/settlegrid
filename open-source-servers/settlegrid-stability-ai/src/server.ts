/**
 * settlegrid-stability-ai — Stability AI MCP Server
 *
 * Wraps the Stability AI API with SettleGrid billing.
 * Requires STABILITY_API_KEY environment variable.
 *
 * Methods:
 *   list_engines()                           (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListEnginesInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.stability.ai/v1'
const USER_AGENT = 'settlegrid-stability-ai/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.STABILITY_API_KEY
  if (!key) throw new Error('STABILITY_API_KEY environment variable is required')
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
    throw new Error(`Stability AI API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'stability-ai',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_engines: { costCents: 1, displayName: 'List available Stable Diffusion engines' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listEngines = sg.wrap(async (args: ListEnginesInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/engines/list', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 50) : [data]

  return { count: items.length, results: items }
}, { method: 'list_engines' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listEngines }

console.log('settlegrid-stability-ai MCP server ready')
console.log('Methods: list_engines')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
