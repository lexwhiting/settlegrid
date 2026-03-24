/**
 * settlegrid-opentdb — Open Trivia Database MCP Server
 *
 * Get random trivia questions from the Open Trivia Database.
 *
 * Methods:
 *   get_questions(amount, difficulty) — Get random trivia questions  (1¢)
 *   get_categories()              — List all trivia categories  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetQuestionsInput {
  amount?: number
  difficulty?: string
}

interface GetCategoriesInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://opentdb.com'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-opentdb/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Open Trivia Database API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'opentdb',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_questions: { costCents: 1, displayName: 'Get Questions' },
      get_categories: { costCents: 1, displayName: 'Get Categories' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getQuestions = sg.wrap(async (args: GetQuestionsInput) => {
  const amount = typeof args.amount === 'number' ? args.amount : 0
  const difficulty = typeof args.difficulty === 'string' ? args.difficulty.trim() : ''
  const data = await apiFetch<any>(`/api.php?amount=${amount}&difficulty=${encodeURIComponent(difficulty)}`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        category: item.category,
        type: item.type,
        difficulty: item.difficulty,
        question: item.question,
        correct_answer: item.correct_answer,
        incorrect_answers: item.incorrect_answers,
    })),
  }
}, { method: 'get_questions' })

const getCategories = sg.wrap(async (args: GetCategoriesInput) => {

  const data = await apiFetch<any>(`/api_category.php`)
  const items = (data.trivia_categories ?? []).slice(0, 50)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
    })),
  }
}, { method: 'get_categories' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getQuestions, getCategories }

console.log('settlegrid-opentdb MCP server ready')
console.log('Methods: get_questions, get_categories')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
