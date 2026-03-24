/**
 * settlegrid-huggingface — Hugging Face MCP Server
 *
 * Wraps the Hugging Face API with SettleGrid billing.
 * Requires HUGGINGFACE_API_KEY environment variable.
 *
 * Methods:
 *   infer(model, inputs)                     (3¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface InferInput {
  model: string
  inputs: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api-inference.huggingface.co/models'
const USER_AGENT = 'settlegrid-huggingface/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.HUGGINGFACE_API_KEY
  if (!key) throw new Error('HUGGINGFACE_API_KEY environment variable is required')
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
    throw new Error(`Hugging Face API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'huggingface',
  pricing: {
    defaultCostCents: 1,
    methods: {
      infer: { costCents: 3, displayName: 'Run inference on a Hugging Face model' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const infer = sg.wrap(async (args: InferInput) => {
  if (!args.model || typeof args.model !== 'string') {
    throw new Error('model is required (model id (e.g. gpt2, bert-base-uncased))')
  }
  if (!args.inputs || typeof args.inputs !== 'string') {
    throw new Error('inputs is required (input text)')
  }

  const body: Record<string, unknown> = {}
  body['model'] = args.model
  body['inputs'] = args.inputs

  const data = await apiFetch<Record<string, unknown>>(`/${encodeURIComponent(String(args.model))}`, {
    method: 'POST',
    body,
  })

  return data
}, { method: 'infer' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { infer }

console.log('settlegrid-huggingface MCP server ready')
console.log('Methods: infer')
console.log('Pricing: 3¢ per call | Powered by SettleGrid')
