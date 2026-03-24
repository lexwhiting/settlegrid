/**
 * settlegrid-jservice — JService Jeopardy MCP Server
 *
 * Methods:
 *   get_random(count?)       — Random Jeopardy clues    (1¢)
 *   get_categories(count?)   — List categories           (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RandomInput { count?: number }
interface CategoriesInput { count?: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://jservice.io/api'

async function jFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`JService API ${res.status}: ${body.slice(0, 200)}`)
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
      get_categories: { costCents: 1, displayName: 'Get Categories' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRandom = sg.wrap(async (args: RandomInput) => {
  const count = Math.min(Math.max(args.count || 5, 1), 100)
  const data = await jFetch<Array<{ id: number; question: string; answer: string; value: number; category: { id: number; title: string }; airdate: string }>>(`/random?count=${count}`)
  return {
    count: data.length,
    clues: data.map((c) => ({
      id: c.id,
      question: c.question,
      answer: c.answer?.replace(/<[^>]*>/g, ''),
      value: c.value,
      category: c.category?.title,
      airdate: c.airdate,
    })),
  }
}, { method: 'get_random' })

const getCategories = sg.wrap(async (args: CategoriesInput) => {
  const count = Math.min(Math.max(args.count || 10, 1), 100)
  const data = await jFetch<Array<{ id: number; title: string; clues_count: number }>>(`/categories?count=${count}`)
  return {
    categories: data.map((c) => ({
      id: c.id,
      title: c.title,
      cluesCount: c.clues_count,
    })),
  }
}, { method: 'get_categories' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRandom, getCategories }

console.log('settlegrid-jservice MCP server ready')
console.log('Methods: get_random, get_categories')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
