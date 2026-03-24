/**
 * settlegrid-trivia-api — Trivia Questions MCP Server
 *
 * Wraps Open Trivia Database with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_trivia(amount?, category?, difficulty?) — trivia questions (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TriviaInput { amount?: number; category?: number; difficulty?: string }

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'trivia-api',
  pricing: { defaultCostCents: 1, methods: { get_trivia: { costCents: 1, displayName: 'Get Trivia' } } },
})

const getTrivia = sg.wrap(async (args: TriviaInput) => {
  const amount = Math.min(Math.max(args.amount ?? 5, 1), 50)
  let url = `https://opentdb.com/api.php?amount=${amount}`
  if (args.category) url += `&category=${args.category}`
  if (args.difficulty) url += `&difficulty=${args.difficulty}`
  const data = await apiFetch<any>(url)
  if (data.response_code !== 0) throw new Error('No results found for the given parameters')
  return {
    questions: (data.results || []).map((q: any) => ({
      category: q.category, type: q.type, difficulty: q.difficulty,
      question: q.question.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&'),
      correct_answer: q.correct_answer, incorrect_answers: q.incorrect_answers,
    })),
  }
}, { method: 'get_trivia' })

export { getTrivia }

console.log('settlegrid-trivia-api MCP server ready')
console.log('Methods: get_trivia')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
