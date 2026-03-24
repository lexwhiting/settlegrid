/**
 * settlegrid-opentdb — Open Trivia Database MCP Server
 *
 * Methods:
 *   get_questions(amount?, category?, difficulty?)  — Get trivia questions  (1¢)
 *   get_categories()                                — List categories       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface QuestionsInput {
  amount?: number
  category?: number
  difficulty?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://opentdb.com'

async function triviaFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenTDB API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function decodeHtml(text: string): string {
  return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
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

const getQuestions = sg.wrap(async (args: QuestionsInput) => {
  const amount = Math.min(Math.max(args.amount || 10, 1), 50)
  let url = `/api.php?amount=${amount}`
  if (args.category && args.category >= 9 && args.category <= 32) {
    url += `&category=${args.category}`
  }
  const validDiffs = ['easy', 'medium', 'hard']
  if (args.difficulty && validDiffs.includes(args.difficulty)) {
    url += `&difficulty=${args.difficulty}`
  }
  const data = await triviaFetch<{ response_code: number; results: Array<{ category: string; type: string; difficulty: string; question: string; correct_answer: string; incorrect_answers: string[] }> }>(url)
  if (data.response_code !== 0) throw new Error(`OpenTDB response code: ${data.response_code}`)
  return {
    count: data.results.length,
    questions: data.results.map((q) => ({
      category: decodeHtml(q.category),
      difficulty: q.difficulty,
      type: q.type,
      question: decodeHtml(q.question),
      correctAnswer: decodeHtml(q.correct_answer),
      incorrectAnswers: q.incorrect_answers.map(decodeHtml),
    })),
  }
}, { method: 'get_questions' })

const getCategories = sg.wrap(async () => {
  const data = await triviaFetch<{ trivia_categories: Array<{ id: number; name: string }> }>('/api_category.php')
  return { categories: data.trivia_categories }
}, { method: 'get_categories' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getQuestions, getCategories }

console.log('settlegrid-opentdb MCP server ready')
console.log('Methods: get_questions, get_categories')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
