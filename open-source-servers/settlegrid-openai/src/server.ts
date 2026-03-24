/**
 * settlegrid-openai — OpenAI MCP Server
 *
 * Wraps the OpenAI API with SettleGrid billing.
 * Requires OPENAI_API_KEY environment variable.
 *
 * Methods:
 *   chat(message)                            (5¢)
 *   create_embedding(input)                  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatInput {
  message: string
  model?: string
  max_tokens?: number
}

interface CreateEmbeddingInput {
  input: string
  model?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.openai.com/v1'
const USER_AGENT = 'settlegrid-openai/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY environment variable is required')
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
    throw new Error(`OpenAI API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'openai',
  pricing: {
    defaultCostCents: 1,
    methods: {
      chat: { costCents: 5, displayName: 'Send a chat completion request' },
      create_embedding: { costCents: 1, displayName: 'Create text embeddings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const chat = sg.wrap(async (args: ChatInput) => {
  if (!args.message || typeof args.message !== 'string') {
    throw new Error('message is required (user message)')
  }

  const body: Record<string, unknown> = {}
  body['messages'] = args.message
  if (args.model !== undefined) body['model'] = args.model
  if (args.max_tokens !== undefined) body['max_tokens'] = args.max_tokens

  const data = await apiFetch<Record<string, unknown>>('/chat/completions', {
    method: 'POST',
    body,
  })

  return data
}, { method: 'chat' })

const createEmbedding = sg.wrap(async (args: CreateEmbeddingInput) => {
  if (!args.input || typeof args.input !== 'string') {
    throw new Error('input is required (text to embed)')
  }

  const body: Record<string, unknown> = {}
  body['input'] = args.input
  if (args.model !== undefined) body['model'] = args.model

  const data = await apiFetch<Record<string, unknown>>('/embeddings', {
    method: 'POST',
    body,
  })

  return data
}, { method: 'create_embedding' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { chat, createEmbedding }

console.log('settlegrid-openai MCP server ready')
console.log('Methods: chat, create_embedding')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')
