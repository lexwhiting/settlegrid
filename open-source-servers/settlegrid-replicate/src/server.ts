/**
 * settlegrid-replicate — Replicate MCP Server
 *
 * Wraps the Replicate API with SettleGrid billing.
 * Requires REPLICATE_API_TOKEN environment variable.
 *
 * Methods:
 *   create_prediction(version, prompt)       (5¢)
 *   get_prediction(id)                       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CreatePredictionInput {
  version: string
  prompt: string
}

interface GetPredictionInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.replicate.com/v1'
const USER_AGENT = 'settlegrid-replicate/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.REPLICATE_API_TOKEN
  if (!key) throw new Error('REPLICATE_API_TOKEN environment variable is required')
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
    throw new Error(`Replicate API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'replicate',
  pricing: {
    defaultCostCents: 1,
    methods: {
      create_prediction: { costCents: 5, displayName: 'Create a prediction with a model' },
      get_prediction: { costCents: 1, displayName: 'Get prediction status and output' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const createPrediction = sg.wrap(async (args: CreatePredictionInput) => {
  if (!args.version || typeof args.version !== 'string') {
    throw new Error('version is required (model version hash)')
  }
  if (!args.prompt || typeof args.prompt !== 'string') {
    throw new Error('prompt is required (input prompt)')
  }

  const body: Record<string, unknown> = {}
  body['version'] = args.version
  body['prompt'] = args.prompt

  const data = await apiFetch<Record<string, unknown>>('/predictions', {
    method: 'POST',
    body,
  })

  return data
}, { method: 'create_prediction' })

const getPrediction = sg.wrap(async (args: GetPredictionInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (prediction id)')
  }

  const params: Record<string, string> = {}
  params['id'] = String(args.id)

  const data = await apiFetch<Record<string, unknown>>(`/predictions/${encodeURIComponent(String(args.id))}`, {
    params,
  })

  return data
}, { method: 'get_prediction' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { createPrediction, getPrediction }

console.log('settlegrid-replicate MCP server ready')
console.log('Methods: create_prediction, get_prediction')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')
