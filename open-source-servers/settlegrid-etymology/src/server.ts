/**
 * settlegrid-etymology — Word Origin & Definition MCP Server
 * Wraps Free Dictionary API with SettleGrid billing.
 * Methods:
 *   get_definition(word, lang?) — Get definitions (1¢)
 *   get_etymology(word)         — Get etymology (2¢)
 *   get_phonetics(word)         — Get phonetics (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface WordInput {
  word: string
  lang?: string
}

interface SimpleWordInput {
  word: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries'

async function apiFetch<T>(lang: string, word: string): Promise<T> {
  const res = await fetch(`${API_BASE}/${lang}/${encodeURIComponent(word)}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-etymology/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Dictionary API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'etymology',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_definition: { costCents: 1, displayName: 'Get word definitions' },
      get_etymology: { costCents: 2, displayName: 'Get word etymology' },
      get_phonetics: { costCents: 1, displayName: 'Get word phonetics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getDefinition = sg.wrap(async (args: WordInput) => {
  if (!args.word || typeof args.word !== 'string') {
    throw new Error('word is required')
  }
  const lang = args.lang || 'en'
  return apiFetch<unknown>(lang, args.word)
}, { method: 'get_definition' })

const getEtymology = sg.wrap(async (args: SimpleWordInput) => {
  if (!args.word || typeof args.word !== 'string') {
    throw new Error('word is required')
  }
  const data = await apiFetch<Array<{ origin?: string; meanings?: unknown[] }>>('en', args.word)
  return {
    word: args.word,
    origin: data[0]?.origin || 'Etymology not available',
    meanings: data[0]?.meanings || [],
  }
}, { method: 'get_etymology' })

const getPhonetics = sg.wrap(async (args: SimpleWordInput) => {
  if (!args.word || typeof args.word !== 'string') {
    throw new Error('word is required')
  }
  const data = await apiFetch<Array<{ phonetics?: Array<{ text?: string; audio?: string }> }>>('en', args.word)
  return {
    word: args.word,
    phonetics: data[0]?.phonetics || [],
  }
}, { method: 'get_phonetics' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getDefinition, getEtymology, getPhonetics }

console.log('settlegrid-etymology MCP server ready')
console.log('Methods: get_definition, get_etymology, get_phonetics')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
