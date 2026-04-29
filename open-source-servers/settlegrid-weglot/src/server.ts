/**
 * settlegrid-weglot — Weglot Translation MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.weglot.com'
const USER_AGENT = 'settlegrid-weglot/1.0'

function getApiKey(): string {
  const k = process.env.WEGLOT_API_KEY
  if (!k) throw new Error('WEGLOT_API_KEY environment variable is required')
  return k
}

interface WordObject {
  w: string
  t: number
  to?: string
}

interface TranslateInput {
  l_from: string
  l_to: string
  words: WordObject[]
  request_url?: string
}

interface GetTranslationsInput {
  l_from?: string
  l_to?: string
}

interface UpdateTranslationsInput {
  l_from: string
  l_to: string
  words: WordObject[]
}

const sg = settlegrid.init({
  toolSlug: 'weglot',
  pricing: {
    defaultCostCents: 1,
    methods: {
      translate_content: { costCents: 3, displayName: 'Translate Content' },
      get_api_status: { costCents: 1, displayName: 'Get API Status' },
      get_translations: { costCents: 1, displayName: 'Get Translations' },
      update_translations: { costCents: 3, displayName: 'Update Translations' },
    },
  },
})

const translateContent = sg.wrap(async (args: TranslateInput) => {
  const apiKey = getApiKey()

  if (!args.l_from?.trim()) throw new Error('l_from is required')
  if (!args.l_to?.trim()) throw new Error('l_to is required')
  if (!Array.isArray(args.words) || args.words.length === 0) throw new Error('words array is required and must not be empty')

  const words = args.words.slice(0, 50)

  const body: Record<string, unknown> = {
    api_key: apiKey,
    l_from: args.l_from.trim(),
    l_to: args.l_to.trim(),
    words,
  }
  if (args.request_url) body.request_url = args.request_url

  const res = await fetch(`${BASE}/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Weglot API ${res.status}: ${text.slice(0, 200)}`)
  }

  return res.json()
}, { method: 'translate_content' })

const getApiStatus = sg.wrap(async (_args: Record<string, never>) => {
  const apiKey = getApiKey()

  const res = await fetch(`${BASE}/status?api_key=${encodeURIComponent(apiKey)}`, {
    method: 'GET',
    headers: { 'User-Agent': USER_AGENT },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Weglot API ${res.status}: ${text.slice(0, 200)}`)
  }

  return res.json()
}, { method: 'get_api_status' })

const getTranslations = sg.wrap(async (args: GetTranslationsInput) => {
  const apiKey = getApiKey()

  const params = new URLSearchParams({ api_key: apiKey })
  if (args.l_from?.trim()) params.set('l_from', args.l_from.trim())
  if (args.l_to?.trim()) params.set('l_to', args.l_to.trim())

  const res = await fetch(`${BASE}/translations?${params.toString()}`, {
    method: 'GET',
    headers: { 'User-Agent': USER_AGENT },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Weglot API ${res.status}: ${text.slice(0, 200)}`)
  }

  return res.json()
}, { method: 'get_translations' })

const updateTranslations = sg.wrap(async (args: UpdateTranslationsInput) => {
  const apiKey = getApiKey()

  if (!args.l_from?.trim()) throw new Error('l_from is required')
  if (!args.l_to?.trim()) throw new Error('l_to is required')
  if (!Array.isArray(args.words) || args.words.length === 0) throw new Error('words array is required and must not be empty')

  const words = args.words.slice(0, 50)

  const body = {
    api_key: apiKey,
    l_from: args.l_from.trim(),
    l_to: args.l_to.trim(),
    words,
  }

  const res = await fetch(`${BASE}/translations`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Weglot API ${res.status}: ${text.slice(0, 200)}`)
  }

  return res.json()
}, { method: 'update_translations' })

export { translateContent, getApiStatus, getTranslations, updateTranslations }
console.log('settlegrid-weglot MCP server ready')
console.log('Methods: translate_content, get_api_status, get_translations, update_translations')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')