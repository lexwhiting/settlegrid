/**
 * settlegrid-free-dictionary — Free Dictionary MCP Server
 *
 * Wraps Free Dictionary API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   define_word(word) — get definition (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WordInput { word: string }

const API_BASE = 'https://api.dictionaryapi.dev/api/v2'

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Word not found')
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'free-dictionary',
  pricing: {
    defaultCostCents: 1,
    methods: {
      define_word: { costCents: 1, displayName: 'Define Word' },
    },
  },
})

const defineWord = sg.wrap(async (args: WordInput) => {
  if (!args.word) throw new Error('word is required')
  const data = await apiFetch<any[]>(`/entries/en/${encodeURIComponent(args.word)}`)
  const entry = data[0]
  return {
    word: entry.word,
    phonetic: entry.phonetic,
    phonetics: (entry.phonetics || []).map((p: any) => ({ text: p.text, audio: p.audio })),
    meanings: (entry.meanings || []).map((m: any) => ({
      part_of_speech: m.partOfSpeech,
      definitions: (m.definitions || []).slice(0, 5).map((d: any) => ({
        definition: d.definition, example: d.example, synonyms: d.synonyms?.slice(0, 5),
      })),
      synonyms: m.synonyms?.slice(0, 10),
      antonyms: m.antonyms?.slice(0, 10),
    })),
    source_urls: entry.sourceUrls,
  }
}, { method: 'define_word' })

export { defineWord }

console.log('settlegrid-free-dictionary MCP server ready')
console.log('Methods: define_word')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
