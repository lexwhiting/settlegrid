/**
 * settlegrid-would-you-rather — Would You Rather MCP Server
 *
 * Methods:
 *   get_question()                   (1¢)
 *   get_questions(count)             (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetQuestionsInput { count?: number }

const USER_AGENT = 'settlegrid-would-you-rather/1.0 (contact@settlegrid.ai)'

const QUESTIONS = [
  { option_a: "Have the ability to fly", option_b: "Have the ability to be invisible" },
  { option_a: "Always be 10 minutes late", option_b: "Always be 20 minutes early" },
  { option_a: "Know the history of every object you touch", option_b: "Know the future of every person you touch" },
  { option_a: "Have free WiFi everywhere", option_b: "Have free coffee everywhere" },
  { option_a: "Speak every language fluently", option_b: "Play every instrument perfectly" },
  { option_a: "Live in a treehouse", option_b: "Live in a submarine" },
  { option_a: "Have unlimited storage on all devices", option_b: "Have unlimited battery life on all devices" },
  { option_a: "Travel 100 years into the past", option_b: "Travel 100 years into the future" },
  { option_a: "Never use social media again", option_b: "Never watch a movie or TV show again" },
  { option_a: "Always be slightly too cold", option_b: "Always be slightly too hot" },
  { option_a: "Have a rewind button for your life", option_b: "Have a pause button for your life" },
  { option_a: "Know how you will die", option_b: "Know when you will die" },
  { option_a: "Have hands for feet", option_b: "Have feet for hands" },
  { option_a: "Be able to breathe underwater", option_b: "Be able to survive in space without a suit" },
  { option_a: "Always have to sing instead of talk", option_b: "Always have to dance instead of walk" },
  { option_a: "Be the funniest person alive", option_b: "Be the smartest person alive" },
  { option_a: "Live without music", option_b: "Live without books" },
  { option_a: "Be famous but poor", option_b: "Be rich but unknown" },
  { option_a: "Have a photographic memory", option_b: "Be able to forget anything on command" },
  { option_a: "Live in the Harry Potter universe", option_b: "Live in the Star Wars universe" },
]

const sg = settlegrid.init({
  toolSlug: 'would-you-rather',
  pricing: { defaultCostCents: 1, methods: {
    get_question: { costCents: 1, displayName: 'Get a random question' },
    get_questions: { costCents: 1, displayName: 'Get multiple questions' },
  }},
})

const getQuestion = sg.wrap(async () => {
  const idx = Math.floor(Math.random() * QUESTIONS.length)
  return { id: idx + 1, ...QUESTIONS[idx] }
}, { method: 'get_question' })

const getQuestions = sg.wrap(async (args: GetQuestionsInput) => {
  const count = Math.min(Math.max(args.count ?? 5, 1), 20)
  const shuffled = [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0, count)
  return { count: shuffled.length, questions: shuffled.map((q, i) => ({ id: i + 1, ...q })) }
}, { method: 'get_questions' })

export { getQuestion, getQuestions }

console.log('settlegrid-would-you-rather MCP server ready')
console.log('Methods: get_question, get_questions')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
