/**
 * settlegrid-stack-exchange — Stack Overflow Q&A MCP Server
 *
 * Wraps the Stack Exchange API with SettleGrid billing.
 * No API key needed for basic usage.
 *
 * Methods:
 *   search_questions(query, tagged, pagesize)  — Search questions  (1¢)
 *   get_answers(question_id)                   — Get answers       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  tagged?: string
  pagesize?: number
}

interface AnswersInput {
  question_id: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SE_BASE = 'https://api.stackexchange.com/2.3'

async function seFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${SE_BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Stack Exchange API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').slice(0, 500)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'stack-exchange',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_questions: { costCents: 1, displayName: 'Search Questions' },
      get_answers: { costCents: 1, displayName: 'Get Answers' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchQuestions = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const pagesize = Math.min(Math.max(args.pagesize ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  let url = `/search/advanced?order=desc&sort=relevance&q=${q}&site=stackoverflow&pagesize=${pagesize}&filter=withbody`
  if (args.tagged) url += `&tagged=${encodeURIComponent(args.tagged)}`

  const data = await seFetch<{ items: any[]; has_more: boolean }>(url)
  return {
    query: args.query,
    count: data.items.length,
    hasMore: data.has_more,
    questions: data.items.map((q: any) => ({
      questionId: q.question_id,
      title: q.title,
      score: q.score,
      answerCount: q.answer_count,
      isAnswered: q.is_answered,
      tags: q.tags,
      link: q.link,
      body: stripHtml(q.body || ''),
      creationDate: new Date(q.creation_date * 1000).toISOString(),
    })),
  }
}, { method: 'search_questions' })

const getAnswers = sg.wrap(async (args: AnswersInput) => {
  if (typeof args.question_id !== 'number' || !Number.isFinite(args.question_id)) {
    throw new Error('question_id must be a number')
  }
  const data = await seFetch<{ items: any[] }>(
    `/questions/${args.question_id}/answers?order=desc&sort=votes&site=stackoverflow&filter=withbody`
  )
  return {
    questionId: args.question_id,
    count: data.items.length,
    answers: data.items.map((a: any) => ({
      answerId: a.answer_id,
      score: a.score,
      isAccepted: a.is_accepted,
      body: stripHtml(a.body || ''),
      creationDate: new Date(a.creation_date * 1000).toISOString(),
    })),
  }
}, { method: 'get_answers' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchQuestions, getAnswers }

console.log('settlegrid-stack-exchange MCP server ready')
console.log('Methods: search_questions, get_answers')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
