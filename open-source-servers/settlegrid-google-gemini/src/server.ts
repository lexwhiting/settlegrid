/**
 * settlegrid-google-gemini — Google Gemini MCP Server
 *
 * Wraps the Google Gemini API with SettleGrid billing.
 * Requires GOOGLE_GEMINI_API_KEY environment variable.
 *
 * Methods:
 *   generate(text)                           (3¢)
 *   list_models()                            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GenerateInput {
  text: string
}

interface ListModelsInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const USER_AGENT = 'settlegrid-google-gemini/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.GOOGLE_GEMINI_API_KEY
  if (!key) throw new Error('GOOGLE_GEMINI_API_KEY environment variable is required')
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
  url.searchParams.set('key', getApiKey())
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
    throw new Error(`Google Gemini API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'google-gemini',
  pricing: {
    defaultCostCents: 1,
    methods: {
      generate: { costCents: 3, displayName: 'Generate content with Gemini' },
      list_models: { costCents: 1, displayName: 'List available Gemini models' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const generate = sg.wrap(async (args: GenerateInput) => {
  if (!args.text || typeof args.text !== 'string') {
    throw new Error('text is required (input text prompt)')
  }

  const body: Record<string, unknown> = {}
  body['text'] = args.text

  const data = await apiFetch<Record<string, unknown>>('/models/gemini-pro:generateContent', {
    method: 'POST',
    body,
  })

  return data
}, { method: 'generate' })

const listModels = sg.wrap(async (args: ListModelsInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/models', {
    params,
  })

  return data
}, { method: 'list_models' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { generate, listModels }

console.log('settlegrid-google-gemini MCP server ready')
console.log('Methods: generate, list_models')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')
