/**
 * settlegrid-elevenlabs — ElevenLabs MCP Server
 *
 * Wraps the ElevenLabs API with SettleGrid billing.
 * Requires ELEVENLABS_API_KEY environment variable.
 *
 * Methods:
 *   list_voices()                            (1¢)
 *   get_models()                             (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListVoicesInput {
}

interface GetModelsInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.elevenlabs.io/v1'
const USER_AGENT = 'settlegrid-elevenlabs/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new Error('ELEVENLABS_API_KEY environment variable is required')
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
    'xi-api-key': `${getApiKey()}`,
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
    throw new Error(`ElevenLabs API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'elevenlabs',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_voices: { costCents: 1, displayName: 'Get list of available voices' },
      get_models: { costCents: 1, displayName: 'Get available TTS models' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listVoices = sg.wrap(async (args: ListVoicesInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/voices', {
    params,
  })

  return data
}, { method: 'list_voices' })

const getModels = sg.wrap(async (args: GetModelsInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/models', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 50) : [data]

  return { count: items.length, results: items }
}, { method: 'get_models' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listVoices, getModels }

console.log('settlegrid-elevenlabs MCP server ready')
console.log('Methods: list_voices, get_models')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
