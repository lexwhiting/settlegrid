/**
 * settlegrid-deepl — DeepL MCP Server
 *
 * Wraps the DeepL API with SettleGrid billing.
 * Requires DEEPL_API_KEY environment variable.
 *
 * Methods:
 *   translate(text, target_lang)             (2¢)
 *   get_languages()                          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TranslateInput {
  text: string
  target_lang: string
  source_lang?: string
}

interface GetLanguagesInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api-free.deepl.com/v2'
const USER_AGENT = 'settlegrid-deepl/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.DEEPL_API_KEY
  if (!key) throw new Error('DEEPL_API_KEY environment variable is required')
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
    'Authorization': `DeepL-Auth-Key ${getApiKey()}`,
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
    throw new Error(`DeepL API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'deepl',
  pricing: {
    defaultCostCents: 1,
    methods: {
      translate: { costCents: 2, displayName: 'Translate text between languages' },
      get_languages: { costCents: 1, displayName: 'Get supported languages' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const translate = sg.wrap(async (args: TranslateInput) => {
  if (!args.text || typeof args.text !== 'string') {
    throw new Error('text is required (text to translate)')
  }
  if (!args.target_lang || typeof args.target_lang !== 'string') {
    throw new Error('target_lang is required (target language (e.g. de, fr, es))')
  }

  const body: Record<string, unknown> = {}
  body['text'] = args.text
  body['target_lang'] = args.target_lang
  if (args.source_lang !== undefined) body['source_lang'] = args.source_lang

  const data = await apiFetch<Record<string, unknown>>('/translate', {
    method: 'POST',
    body,
  })

  return data
}, { method: 'translate' })

const getLanguages = sg.wrap(async (args: GetLanguagesInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/languages', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 50) : [data]

  return { count: items.length, results: items }
}, { method: 'get_languages' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { translate, getLanguages }

console.log('settlegrid-deepl MCP server ready')
console.log('Methods: translate, get_languages')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
