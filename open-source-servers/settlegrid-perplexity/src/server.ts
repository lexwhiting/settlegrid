/**
 * settlegrid-perplexity — Perplexity MCP Server
 *
 * Wraps the Perplexity API with SettleGrid billing.
 * Requires PERPLEXITY_API_KEY environment variable.
 *
 * Methods:
 *   chat(message)                            (5¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatInput {
  message: string
  model?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.perplexity.ai'
const USER_AGENT = 'settlegrid-perplexity/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.PERPLEXITY_API_KEY
  if (!key) throw new Error('PERPLEXITY_API_KEY environment variable is required')
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
    throw new Error(`Perplexity API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'perplexity',
  pricing: {
    defaultCostCents: 1,
    methods: {
      chat: { costCents: 5, displayName: 'Chat completion with web-augmented AI' },
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

// ─── Exports ────────────────────────────────────────────────────────────────

export { chat }

console.log('settlegrid-perplexity MCP server ready')
console.log('Methods: chat')
console.log('Pricing: 5¢ per call | Powered by SettleGrid')
