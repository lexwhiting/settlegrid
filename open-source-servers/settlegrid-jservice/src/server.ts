/**
 * settlegrid-jservice — jService (Jeopardy) MCP Server
 *
 * Get Jeopardy-style trivia clues from the jService API.
 *
 * Methods:
 *   get_random(count)             — Get random Jeopardy clues  (1¢)
 *   get_clues(category)           — Get clues by category ID  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetRandomInput {
  count?: number
}

interface GetCluesInput {
  category: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://jservice.io/api'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-jservice/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`jService (Jeopardy) API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'jservice',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_random: { costCents: 1, displayName: 'Random Clues' },
      get_clues: { costCents: 1, displayName: 'Get Clues' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRandom = sg.wrap(async (args: GetRandomInput) => {
  const count = typeof args.count === 'number' ? args.count : 0
  const data = await apiFetch<any>(`/random?count=${count}`)
  return {
    id: data.id,
    answer: data.answer,
    question: data.question,
    value: data.value,
    category: data.category,
  }
}, { method: 'get_random' })

const getClues = sg.wrap(async (args: GetCluesInput) => {
  if (typeof args.category !== 'number') throw new Error('category is required and must be a number')
  const category = args.category
  const data = await apiFetch<any>(`/clues?category=${category}`)
  return {
    id: data.id,
    answer: data.answer,
    question: data.question,
    value: data.value,
    airdate: data.airdate,
  }
}, { method: 'get_clues' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRandom, getClues }

console.log('settlegrid-jservice MCP server ready')
console.log('Methods: get_random, get_clues')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
