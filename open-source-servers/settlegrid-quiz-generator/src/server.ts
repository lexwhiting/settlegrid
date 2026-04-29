/**
 * settlegrid-quiz-generator — Quiz Generator MCP Server
 *
 * Quiz Generator tools with SettleGrid billing.
 * Pricing: 1-3c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

interface GenerateInput { topic: string; count?: number; difficulty?: string }

const QUIZ_DB: Record<string, Array<{ question: string; options: string[]; answer: number; explanation: string }>> = {
  javascript: [
    { question: 'What does typeof null return?', options: ['null', 'undefined', 'object', 'number'], answer: 2, explanation: 'This is a known bug in JavaScript. typeof null returns "object".' },
    { question: 'Which method converts JSON string to object?', options: ['JSON.parse()', 'JSON.stringify()', 'JSON.toObject()', 'JSON.convert()'], answer: 0, explanation: 'JSON.parse() parses a JSON string to a JavaScript object.' },
    { question: 'What is the output of 0.1 + 0.2 === 0.3?', options: ['true', 'false', 'undefined', 'NaN'], answer: 1, explanation: 'Due to floating point precision, 0.1 + 0.2 is 0.30000000000000004.' },
    { question: 'Which is NOT a primitive type?', options: ['string', 'boolean', 'object', 'symbol'], answer: 2, explanation: 'Object is not a primitive type — it is a reference type.' },
  ],
  python: [
    { question: 'What does len([]) return?', options: ['None', '0', 'False', 'Error'], answer: 1, explanation: 'len() of an empty list returns 0.' },
    { question: 'Which keyword creates a generator?', options: ['return', 'yield', 'generate', 'async'], answer: 1, explanation: 'yield pauses function execution and returns a value to the caller.' },
    { question: 'What is the output of bool("")?', options: ['True', 'False', 'None', 'Error'], answer: 1, explanation: 'Empty strings are falsy in Python.' },
  ],
  general_knowledge: [
    { question: 'What is the largest planet in our solar system?', options: ['Saturn', 'Jupiter', 'Neptune', 'Uranus'], answer: 1, explanation: 'Jupiter has a mass of 1.898 x 10^27 kg.' },
    { question: 'Which element has the chemical symbol Au?', options: ['Silver', 'Aluminum', 'Gold', 'Argon'], answer: 2, explanation: 'Au comes from the Latin "aurum".' },
    { question: 'In which year did World War II end?', options: ['1943', '1944', '1945', '1946'], answer: 2, explanation: 'WWII ended in 1945 with the surrender of Japan.' },
  ],
}

const sg = settlegrid.init({ toolSlug: 'quiz-generator', pricing: { defaultCostCents: 1, methods: {
  generate_quiz: { costCents: 1, displayName: 'Generate Quiz' },
  list_topics: { costCents: 1, displayName: 'List Topics' },
}}})

const generateQuiz = sg.wrap(async (args: GenerateInput) => {
  if (!args.topic) throw new Error('topic required')
  const questions = QUIZ_DB[args.topic.toLowerCase().replace(/ /g, '_')]
  if (!questions) throw new Error(`Unknown topic. Available: ${Object.keys(QUIZ_DB).join(', ')}`)
  const count = Math.min(args.count ?? questions.length, questions.length)
  const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, count)
  return { topic: args.topic, questions: shuffled, count: shuffled.length, difficulty: args.difficulty ?? 'mixed' }
}, { method: 'generate_quiz' })

const listTopics = sg.wrap(async (_a: Record<string, never>) => {
  return { topics: Object.entries(QUIZ_DB).map(([name, qs]) => ({ name, question_count: qs.length })), count: Object.keys(QUIZ_DB).length }
}, { method: 'list_topics' })

export { generateQuiz, listTopics }
console.log('settlegrid-quiz-generator MCP server ready | Powered by SettleGrid')
