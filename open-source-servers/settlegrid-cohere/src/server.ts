/**
 * settlegrid-cohere — Cohere MCP Server
 *
 * Wraps the Cohere API with SettleGrid billing.
 * Requires COHERE_API_KEY environment variable.
 *
 * Methods:
 *   generate(prompt)                         (3¢)
 *   embed(texts)                             (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GenerateInput {
  prompt: string
  max_tokens?: number
}

interface EmbedInput {
  texts: string[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.cohere.ai/v1'
const USER_AGENT = 'settlegrid-cohere/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.COHERE_API_KEY
  if (!key) throw new Error('COHERE_API_KEY environment variable is required')
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
    throw new Error(`Cohere API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'cohere',
  pricing: {
    defaultCostCents: 1,
    methods: {
      generate: { costCents: 3, displayName: 'Generate text with Cohere models' },
      embed: { costCents: 1, displayName: 'Create text embeddings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const generate = sg.wrap(async (args: GenerateInput) => {
  if (!args.prompt || typeof args.prompt !== 'string') {
    throw new Error('prompt is required (input prompt)')
  }

  const body: Record<string, unknown> = {}
  body['prompt'] = args.prompt
  if (args.max_tokens !== undefined) body['max_tokens'] = args.max_tokens

  const data = await apiFetch<Record<string, unknown>>('/generate', {
    method: 'POST',
    body,
  })

  return data
}, { method: 'generate' })

const embed = sg.wrap(async (args: EmbedInput) => {
  if (!Array.isArray(args.texts) || args.texts.length === 0) {
    throw new Error('texts must be a non-empty array')
  }

  const body: Record<string, unknown> = {}
  body['texts'] = args.texts

  const data = await apiFetch<Record<string, unknown>>('/embed', {
    method: 'POST',
    body,
  })

  return data
}, { method: 'embed' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { generate, embed }

console.log('settlegrid-cohere MCP server ready')
console.log('Methods: generate, embed')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')
