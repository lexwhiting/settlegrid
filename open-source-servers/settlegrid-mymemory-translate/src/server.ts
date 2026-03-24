/**
 * settlegrid-mymemory-translate — MyMemory Translation MCP Server
 *
 * Wraps MyMemory Translation API with SettleGrid billing.
 * No API key needed — free tier (1000 words/day).
 *
 * Methods:
 *   translate_text(text, from, to) — translate text (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TranslateInput { text: string; from: string; to: string }

const API_BASE = 'https://api.mymemory.translated.net'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'mymemory-translate',
  pricing: {
    defaultCostCents: 1,
    methods: {
      translate_text: { costCents: 1, displayName: 'Translate Text' },
    },
  },
})

const translateText = sg.wrap(async (args: TranslateInput) => {
  if (!args.text) throw new Error('text is required')
  if (!args.from || !args.to) throw new Error('from and to language codes required')
  if (args.text.length > 5000) throw new Error('Text must be under 5000 characters')
  const langpair = `${args.from}|${args.to}`
  const data = await apiFetch<any>(`/get?q=${encodeURIComponent(args.text)}&langpair=${encodeURIComponent(langpair)}`)
  if (data.responseStatus !== 200) throw new Error(data.responseDetails || 'Translation failed')
  return {
    original: args.text,
    translated: data.responseData.translatedText,
    from: args.from, to: args.to,
    match: data.responseData.match,
    quota_used: data.quotaFinished ? 'quota exhausted' : 'ok',
  }
}, { method: 'translate_text' })

export { translateText }

console.log('settlegrid-mymemory-translate MCP server ready')
console.log('Methods: translate_text')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
