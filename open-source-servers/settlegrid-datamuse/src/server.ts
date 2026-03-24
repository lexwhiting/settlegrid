/**
 * settlegrid-datamuse — Datamuse Word API MCP Server
 *
 * Wraps the Datamuse API for word associations with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   means_like(query)      — Words with similar meaning  (1¢)
 *   sounds_like(word)      — Phonetically similar words  (1¢)
 *   spelled_like(pattern)  — Spelling pattern match       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface MeansLikeInput { query: string }
interface SoundsLikeInput { word: string }
interface SpelledLikeInput { pattern: string }

interface DatamuseResult { word: string; score: number; tags?: string[] }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.datamuse.com'

async function damuseFetch(path: string): Promise<DatamuseResult[]> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Datamuse API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<DatamuseResult[]>
}

function validateInput(val: string, name: string): string {
  if (!val || typeof val !== 'string') throw new Error(`${name} is required`)
  const trimmed = val.trim()
  if (trimmed.length === 0 || trimmed.length > 100) throw new Error(`${name} must be 1-100 characters`)
  return trimmed
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'datamuse',
  pricing: {
    defaultCostCents: 1,
    methods: {
      means_like: { costCents: 1, displayName: 'Means Like' },
      sounds_like: { costCents: 1, displayName: 'Sounds Like' },
      spelled_like: { costCents: 1, displayName: 'Spelled Like' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const meansLike = sg.wrap(async (args: MeansLikeInput) => {
  const query = validateInput(args.query, 'query')
  const results = await damuseFetch(`/words?ml=${encodeURIComponent(query)}&max=25`)
  return { query, count: results.length, words: results.map(r => ({ word: r.word, score: r.score, tags: r.tags || [] })) }
}, { method: 'means_like' })

const soundsLike = sg.wrap(async (args: SoundsLikeInput) => {
  const word = validateInput(args.word, 'word')
  const results = await damuseFetch(`/words?sl=${encodeURIComponent(word)}&max=25`)
  return { word, count: results.length, words: results.map(r => ({ word: r.word, score: r.score })) }
}, { method: 'sounds_like' })

const spelledLike = sg.wrap(async (args: SpelledLikeInput) => {
  const pattern = validateInput(args.pattern, 'pattern')
  const results = await damuseFetch(`/words?sp=${encodeURIComponent(pattern)}&max=25`)
  return { pattern, count: results.length, words: results.map(r => ({ word: r.word, score: r.score })) }
}, { method: 'spelled_like' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { meansLike, soundsLike, spelledLike }

console.log('settlegrid-datamuse MCP server ready')
console.log('Methods: means_like, sounds_like, spelled_like')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
