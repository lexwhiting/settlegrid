/**
 * settlegrid-clarifai — Clarifai MCP Server
 *
 * Wraps the Clarifai API with SettleGrid billing.
 * Requires CLARIFAI_PAT environment variable.
 *
 * Methods:
 *   list_models()                            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListModelsInput {
  per_page?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.clarifai.com/v2'
const USER_AGENT = 'settlegrid-clarifai/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.CLARIFAI_PAT
  if (!key) throw new Error('CLARIFAI_PAT environment variable is required')
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
    throw new Error(`Clarifai API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'clarifai',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_models: { costCents: 1, displayName: 'List available AI models' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listModels = sg.wrap(async (args: ListModelsInput) => {

  const params: Record<string, string> = {}
  if (args.per_page !== undefined) params['per_page'] = String(args.per_page)

  const data = await apiFetch<Record<string, unknown>>('/models', {
    params,
  })

  return data
}, { method: 'list_models' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listModels }

console.log('settlegrid-clarifai MCP server ready')
console.log('Methods: list_models')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
