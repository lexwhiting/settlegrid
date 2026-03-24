/**
 * settlegrid-synonyms — Synonym Finder MCP Server
 *
 * Wraps the Datamuse API with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   get_synonyms(word)                    (1¢)
 *   get_antonyms(word)                    (1¢)
 *   get_related(word)                     (1¢)
 *   get_rhymes(word)                      (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface WordInput { word: string; max?: number }

const API_BASE = "https://api.datamuse.com"
const USER_AGENT = "settlegrid-synonyms/1.0 (contact@settlegrid.ai)"

async function apiFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { headers: { "User-Agent": USER_AGENT } })
  if (!res.ok) throw new Error(`Datamuse API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "synonyms",
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_synonyms: { costCents: 1, displayName: "Find synonyms for a word" },
      get_antonyms: { costCents: 1, displayName: "Find antonyms for a word" },
      get_related: { costCents: 1, displayName: "Find related words" },
      get_rhymes: { costCents: 1, displayName: "Find rhyming words" },
    },
  },
})

const getSynonyms = sg.wrap(async (args: WordInput) => {
  if (!args.word || typeof args.word !== "string") throw new Error("word is required")
  const max = args.max ?? 20
  const data = await apiFetch<Array<{ word: string; score: number }>>("/words", { rel_syn: args.word, max: String(max) })
  return { word: args.word, count: data.length, synonyms: data }
}, { method: "get_synonyms" })

const getAntonyms = sg.wrap(async (args: WordInput) => {
  if (!args.word || typeof args.word !== "string") throw new Error("word is required")
  const max = args.max ?? 20
  const data = await apiFetch<Array<{ word: string; score: number }>>("/words", { rel_ant: args.word, max: String(max) })
  return { word: args.word, count: data.length, antonyms: data }
}, { method: "get_antonyms" })

const getRelated = sg.wrap(async (args: WordInput) => {
  if (!args.word || typeof args.word !== "string") throw new Error("word is required")
  const max = args.max ?? 20
  const data = await apiFetch<Array<{ word: string; score: number }>>("/words", { ml: args.word, max: String(max) })
  return { word: args.word, count: data.length, related: data }
}, { method: "get_related" })

const getRhymes = sg.wrap(async (args: WordInput) => {
  if (!args.word || typeof args.word !== "string") throw new Error("word is required")
  const max = args.max ?? 20
  const data = await apiFetch<Array<{ word: string; score: number; numSyllables: number }>>("/words", { rel_rhy: args.word, max: String(max) })
  return { word: args.word, count: data.length, rhymes: data }
}, { method: "get_rhymes" })

export { getSynonyms, getAntonyms, getRelated, getRhymes }

console.log("settlegrid-synonyms MCP server ready")
console.log("Methods: get_synonyms, get_antonyms, get_related, get_rhymes")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
