/**
 * settlegrid-together-ai — Together AI MCP Server
 *
 * Wraps the Together AI API with SettleGrid billing.
 * Requires TOGETHER_API_KEY environment variable.
 *
 * Methods:
 *   chat(message)                            (3¢)
 *   list_models()                            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatInput {
  message: string
  model?: string
}

interface ListModelsInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.together.xyz/v1'
const USER_AGENT = 'settlegrid-together-ai/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.TOGETHER_API_KEY
  if (!key) throw new Error('TOGETHER_API_KEY environment variable is required')
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
    throw new Error(`Together AI API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'together-ai',
  pricing: {
    defaultCostCents: 1,
    methods: {
      chat: { costCents: 3, displayName: 'Chat completion with open-source models' },
      list_models: { costCents: 1, displayName: 'List available models' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const chat = sg.wrap(async (args: ChatInput) => {
  if (!args.message || typeof args.message !== 'string') {
    throw new Error('message is required (user message)')
  }

  const body: Record<string, unknown> = {}
  body['message'] = args.message
  if (args.model !== undefined) body['model'] = args.model

  const data = await apiFetch<Record<string, unknown>>('/chat/completions', {
    method: 'POST',
    body,
  })

  return data
}, { method: 'chat' })

const listModels = sg.wrap(async (args: ListModelsInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/models', {
    params,
  })

  return data
}, { method: 'list_models' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { chat, listModels }

console.log('settlegrid-together-ai MCP server ready')
console.log('Methods: chat, list_models')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')
