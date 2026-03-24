/**
 * settlegrid-rhyme — Rhyme Finder MCP Server
 *
 * Wraps the Datamuse API for rhyme-finding with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   find_rhymes(word)                     (1¢)
 *   find_near_rhymes(word)                (1¢)
 *   find_homophones(word)                 (1¢)
 *   sounds_like(word)                     (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface WordInput { word: string; max?: number }

const API_BASE = "https://api.datamuse.com"
const USER_AGENT = "settlegrid-rhyme/1.0 (contact@settlegrid.ai)"

async function apiFetch<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/words`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { headers: { "User-Agent": USER_AGENT } })
  if (!res.ok) throw new Error(`Datamuse API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "rhyme",
  pricing: {
    defaultCostCents: 1,
    methods: {
      find_rhymes: { costCents: 1, displayName: "Find perfect rhymes" },
      find_near_rhymes: { costCents: 1, displayName: "Find near/slant rhymes" },
      find_homophones: { costCents: 1, displayName: "Find homophones" },
      sounds_like: { costCents: 1, displayName: "Words that sound similar" },
    },
  },
})

const findRhymes = sg.wrap(async (args: WordInput) => {
  if (!args.word || typeof args.word !== "string") throw new Error("word is required")
  const data = await apiFetch<Array<{ word: string; score: number; numSyllables: number }>>({
    rel_rhy: args.word, max: String(args.max ?? 30),
  })
  return { word: args.word, type: "perfect_rhymes", count: data.length, results: data }
}, { method: "find_rhymes" })

const findNearRhymes = sg.wrap(async (args: WordInput) => {
  if (!args.word || typeof args.word !== "string") throw new Error("word is required")
  const data = await apiFetch<Array<{ word: string; score: number; numSyllables: number }>>({
    rel_nry: args.word, max: String(args.max ?? 30),
  })
  return { word: args.word, type: "near_rhymes", count: data.length, results: data }
}, { method: "find_near_rhymes" })

const findHomophones = sg.wrap(async (args: WordInput) => {
  if (!args.word || typeof args.word !== "string") throw new Error("word is required")
  const data = await apiFetch<Array<{ word: string; score: number }>>({
    rel_hom: args.word, max: String(args.max ?? 20),
  })
  return { word: args.word, type: "homophones", count: data.length, results: data }
}, { method: "find_homophones" })

const soundsLike = sg.wrap(async (args: WordInput) => {
  if (!args.word || typeof args.word !== "string") throw new Error("word is required")
  const data = await apiFetch<Array<{ word: string; score: number }>>({
    sl: args.word, max: String(args.max ?? 30),
  })
  return { word: args.word, type: "sounds_like", count: data.length, results: data }
}, { method: "sounds_like" })

export { findRhymes, findNearRhymes, findHomophones, soundsLike }

console.log("settlegrid-rhyme MCP server ready")
console.log("Methods: find_rhymes, find_near_rhymes, find_homophones, sounds_like")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
