/**
 * settlegrid-dictionary — Free Dictionary MCP Server
 *
 * Wraps the Free Dictionary API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   define(word)                       — Word definitions        (1¢)
 *   define_language(word, language)    — Definitions in language  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DefineInput { word: string }
interface DefineLanguageInput { word: string; language: string }

interface DictionaryEntry {
  word: string
  phonetic?: string
  phonetics: Array<{ text?: string; audio?: string }>
  meanings: Array<{
    partOfSpeech: string
    definitions: Array<{ definition: string; example?: string; synonyms: string[]; antonyms: string[] }>
  }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries'
const VALID_LANGS = new Set(['en', 'es', 'fr', 'de', 'it', 'pt', 'ar', 'cs', 'da', 'el', 'fi', 'hi', 'hu', 'id', 'ja', 'ko', 'nl', 'no', 'pl', 'ro', 'ru', 'sk', 'sv', 'th', 'tr', 'uk', 'zh'])
const WORD_RE = /^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF'-]{1,50}$/

async function dictFetch(lang: string, word: string): Promise<DictionaryEntry[]> {
  const res = await fetch(`${API_BASE}/${lang}/${encodeURIComponent(word)}`)
  if (!res.ok) {
    if (res.status === 404) throw new Error(`Word "${word}" not found in ${lang} dictionary`)
    const body = await res.text().catch(() => '')
    throw new Error(`Dictionary API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<DictionaryEntry[]>
}

function formatEntry(entries: DictionaryEntry[]) {
  return entries.map(e => ({
    word: e.word,
    phonetic: e.phonetic || e.phonetics.find(p => p.text)?.text || null,
    audio: e.phonetics.find(p => p.audio)?.audio || null,
    meanings: e.meanings.map(m => ({
      partOfSpeech: m.partOfSpeech,
      definitions: m.definitions.slice(0, 5).map(d => ({
        definition: d.definition,
        example: d.example || null,
        synonyms: d.synonyms.slice(0, 5),
        antonyms: d.antonyms.slice(0, 5),
      })),
    })),
  }))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'dictionary',
  pricing: {
    defaultCostCents: 1,
    methods: {
      define: { costCents: 1, displayName: 'Define Word' },
      define_language: { costCents: 1, displayName: 'Define in Language' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const define = sg.wrap(async (args: DefineInput) => {
  if (!args.word || typeof args.word !== 'string') throw new Error('word is required')
  const word = args.word.trim().toLowerCase()
  if (!WORD_RE.test(word)) throw new Error('Invalid word format')
  const entries = await dictFetch('en', word)
  return { word, entries: formatEntry(entries) }
}, { method: 'define' })

const defineLanguage = sg.wrap(async (args: DefineLanguageInput) => {
  if (!args.word || typeof args.word !== 'string') throw new Error('word is required')
  if (!args.language || !VALID_LANGS.has(args.language.toLowerCase())) {
    throw new Error(`language must be one of: ${[...VALID_LANGS].sort().join(', ')}`)
  }
  const word = args.word.trim().toLowerCase()
  const lang = args.language.toLowerCase()
  const entries = await dictFetch(lang, word)
  return { word, language: lang, entries: formatEntry(entries) }
}, { method: 'define_language' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { define, defineLanguage }

console.log('settlegrid-dictionary MCP server ready')
console.log('Methods: define, define_language')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
