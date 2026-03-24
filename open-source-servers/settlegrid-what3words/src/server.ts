/**
 * settlegrid-what3words — what3words MCP Server
 *
 * Wraps the what3words API with SettleGrid billing.
 * Requires WHAT3WORDS_API_KEY environment variable.
 *
 * Methods:
 *   convert_to_coords(words)                 (1¢)
 *   convert_to_words(coordinates)            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConvertToCoordsInput {
  words: string
}

interface ConvertToWordsInput {
  coordinates: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.what3words.com/v3'
const USER_AGENT = 'settlegrid-what3words/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.WHAT3WORDS_API_KEY
  if (!key) throw new Error('WHAT3WORDS_API_KEY environment variable is required')
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
    throw new Error(`what3words API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'what3words',
  pricing: {
    defaultCostCents: 1,
    methods: {
      convert_to_coords: { costCents: 1, displayName: 'Convert 3-word address to coordinates' },
      convert_to_words: { costCents: 1, displayName: 'Convert coordinates to 3-word address' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const convertToCoords = sg.wrap(async (args: ConvertToCoordsInput) => {
  if (!args.words || typeof args.words !== 'string') {
    throw new Error('words is required (3-word address (e.g. filled.count.soap))')
  }

  const params: Record<string, string> = {}
  params['words'] = args.words

  const data = await apiFetch<Record<string, unknown>>('/convert-to-coordinates', {
    params,
  })

  return data
}, { method: 'convert_to_coords' })

const convertToWords = sg.wrap(async (args: ConvertToWordsInput) => {
  if (!args.coordinates || typeof args.coordinates !== 'string') {
    throw new Error('coordinates is required (coordinates as lat,lng)')
  }

  const params: Record<string, string> = {}
  params['coordinates'] = args.coordinates

  const data = await apiFetch<Record<string, unknown>>('/convert-to-3wa', {
    params,
  })

  return data
}, { method: 'convert_to_words' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { convertToCoords, convertToWords }

console.log('settlegrid-what3words MCP server ready')
console.log('Methods: convert_to_coords, convert_to_words')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
