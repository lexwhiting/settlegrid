/**
 * settlegrid-thesaurus — Thesaurus MCP Server
 *
 * Wraps the Datamuse API for synonyms/antonyms with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_synonyms(word)             — Find synonyms       (1¢)
 *   get_antonyms(word)             — Find antonyms       (1¢)
 *   get_related(word, relation?)   — Related words        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SynonymInput { word: string }
interface AntonymInput { word: string }
interface RelatedInput { word: string; relation?: string }

interface DatamuseWord { word: string; score: number; tags?: string[] }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.datamuse.com'
const VALID_RELATIONS = new Set(['syn', 'ant', 'trg', 'jja', 'jjb', 'rhy', 'nry', 'hom', 'cns'])

async function damuseFetch(path: string): Promise<DatamuseWord[]> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Datamuse API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<DatamuseWord[]>
}

function validateWord(word: string): string {
  if (!word || typeof word !== 'string') throw new Error('word is required')
  const trimmed = word.trim().toLowerCase()
  if (trimmed.length === 0 || trimmed.length > 50) throw new Error('word must be 1-50 characters')
  return trimmed
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'thesaurus',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_synonyms: { costCents: 1, displayName: 'Get Synonyms' },
      get_antonyms: { costCents: 1, displayName: 'Get Antonyms' },
      get_related: { costCents: 1, displayName: 'Get Related Words' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSynonyms = sg.wrap(async (args: SynonymInput) => {
  const word = validateWord(args.word)
  const results = await damuseFetch(`/words?rel_syn=${encodeURIComponent(word)}&max=25`)
  return { word, count: results.length, synonyms: results.map(r => ({ word: r.word, score: r.score })) }
}, { method: 'get_synonyms' })

const getAntonyms = sg.wrap(async (args: AntonymInput) => {
  const word = validateWord(args.word)
  const results = await damuseFetch(`/words?rel_ant=${encodeURIComponent(word)}&max=25`)
  return { word, count: results.length, antonyms: results.map(r => ({ word: r.word, score: r.score })) }
}, { method: 'get_antonyms' })

const getRelated = sg.wrap(async (args: RelatedInput) => {
  const word = validateWord(args.word)
  const rel = args.relation || 'trg'
  if (!VALID_RELATIONS.has(rel)) {
    throw new Error(`relation must be one of: ${[...VALID_RELATIONS].join(', ')}`)
  }
  const results = await damuseFetch(`/words?rel_${rel}=${encodeURIComponent(word)}&max=25`)
  return { word, relation: rel, count: results.length, words: results.map(r => ({ word: r.word, score: r.score })) }
}, { method: 'get_related' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSynonyms, getAntonyms, getRelated }

console.log('settlegrid-thesaurus MCP server ready')
console.log('Methods: get_synonyms, get_antonyms, get_related')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
