/**
 * settlegrid-agify — Agify MCP Server
 *
 * Wraps the Agify API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   predict(name)                            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PredictInput {
  name: string
  country_id?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.agify.io'
const USER_AGENT = 'settlegrid-agify/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Agify API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'agify',
  pricing: {
    defaultCostCents: 1,
    methods: {
      predict: { costCents: 1, displayName: 'Predict age from a name' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const predict = sg.wrap(async (args: PredictInput) => {
  if (!args.name || typeof args.name !== 'string') {
    throw new Error('name is required (first name to predict age for)')
  }

  const params: Record<string, string> = {}
  params['name'] = args.name
  if (args.country_id !== undefined) params['country_id'] = String(args.country_id)

  const data = await apiFetch<Record<string, unknown>>('', {
    params,
  })

  return data
}, { method: 'predict' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { predict }

console.log('settlegrid-agify MCP server ready')
console.log('Methods: predict')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
