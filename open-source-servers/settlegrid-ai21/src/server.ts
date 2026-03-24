/**
 * settlegrid-ai21 — AI21 MCP Server
 *
 * Wraps the AI21 API with SettleGrid billing.
 * Requires AI21_API_KEY environment variable.
 *
 * Methods:
 *   chat(message)                            (3¢)
 *   paraphrase(text)                         (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatInput {
  message: string
  model?: string
}

interface ParaphraseInput {
  text: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.ai21.com/studio/v1'
const USER_AGENT = 'settlegrid-ai21/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.AI21_API_KEY
  if (!key) throw new Error('AI21_API_KEY environment variable is required')
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
    throw new Error(`AI21 API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ai21',
  pricing: {
    defaultCostCents: 1,
    methods: {
      chat: { costCents: 3, displayName: 'Chat with Jamba models' },
      paraphrase: { costCents: 2, displayName: 'Rewrite text with alternative phrasing' },
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

const paraphrase = sg.wrap(async (args: ParaphraseInput) => {
  if (!args.text || typeof args.text !== 'string') {
    throw new Error('text is required (text to paraphrase)')
  }

  const body: Record<string, unknown> = {}
  body['text'] = args.text

  const data = await apiFetch<Record<string, unknown>>('/paraphrase', {
    method: 'POST',
    body,
  })

  return data
}, { method: 'paraphrase' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { chat, paraphrase }

console.log('settlegrid-ai21 MCP server ready')
console.log('Methods: chat, paraphrase')
console.log('Pricing: 2-3¢ per call | Powered by SettleGrid')
