/**
 * settlegrid-deepgram — Deepgram MCP Server
 *
 * Wraps the Deepgram API with SettleGrid billing.
 * Requires DEEPGRAM_API_KEY environment variable.
 *
 * Methods:
 *   list_models()                            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListModelsInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.deepgram.com/v1'
const USER_AGENT = 'settlegrid-deepgram/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.DEEPGRAM_API_KEY
  if (!key) throw new Error('DEEPGRAM_API_KEY environment variable is required')
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
    throw new Error(`Deepgram API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'deepgram',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_models: { costCents: 1, displayName: 'Get available speech recognition models' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listModels = sg.wrap(async (args: ListModelsInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/models', {
    params,
  })

  return data
}, { method: 'list_models' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listModels }

console.log('settlegrid-deepgram MCP server ready')
console.log('Methods: list_models')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
