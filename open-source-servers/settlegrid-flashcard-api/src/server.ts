/**
 * settlegrid-flashcard-api — Flashcard Generator MCP Server
 *
 * Creates study flashcards with spaced repetition scheduling.
 * Generates cards from topics and manages review intervals.
 *
 * Methods:
 *   create_cards(topic, count?)    — Generate flashcards            (1c)
 *   get_schedule(cards_due, last_review)  — Get review schedule     (1c)
 *   get_topics()                   — List available topics          (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface CreateInput { topic: string; count?: number; difficulty?: string }
interface ScheduleInput { total_cards: number; cards_due: number; last_review?: string }

const TOPICS: Record<string, Array<{ front: string; back: string }>> = {
  javascript: [
    { front: 'What is a closure?', back: 'A function that retains access to its lexical scope even when called outside that scope.' },
    { front: 'What does Array.prototype.reduce() do?', back: 'Executes a reducer function on each element, resulting in a single output value.' },
    { front: 'Difference between let and var?', back: 'let is block-scoped; var is function-scoped. let cannot be re-declared in the same scope.' },
    { front: 'What is the event loop?', back: 'A mechanism that processes async callbacks by checking the callback queue when the call stack is empty.' },
    { front: 'What is hoisting?', back: 'JavaScript moves declarations to the top of their scope during compilation. var is hoisted (undefined), let/const are hoisted but not initialized.' },
    { front: 'What is a Promise?', back: 'An object representing the eventual completion or failure of an async operation.' },
    { front: 'What does Object.freeze() do?', back: 'Makes an object immutable — prevents adding, removing, or modifying properties.' },
    { front: 'What is destructuring?', back: 'Syntax for extracting values from arrays or properties from objects into distinct variables.' },
  ],
  python: [
    { front: 'What is a list comprehension?', back: '[expr for item in iterable if condition] — concise way to create lists.' },
    { front: 'Difference between list and tuple?', back: 'Lists are mutable; tuples are immutable. Tuples are hashable and can be dict keys.' },
    { front: 'What is a decorator?', back: 'A function that wraps another function to extend its behavior without modifying it.' },
    { front: 'What is GIL?', back: 'Global Interpreter Lock — allows only one thread to execute Python bytecode at a time (CPython).' },
    { front: 'What is __init__?', back: 'Constructor method called when a new class instance is created.' },
    { front: 'What are *args and **kwargs?', back: '*args collects positional arguments as tuple; **kwargs collects keyword arguments as dict.' },
  ],
  sql: [
    { front: 'What is a JOIN?', back: 'Combines rows from two or more tables based on a related column.' },
    { front: 'Difference between WHERE and HAVING?', back: 'WHERE filters rows before grouping; HAVING filters groups after GROUP BY.' },
    { front: 'What is normalization?', back: 'Organizing tables to reduce redundancy and dependency. Forms: 1NF, 2NF, 3NF, BCNF.' },
    { front: 'What is an index?', back: 'Data structure that improves query speed on a table at the cost of additional storage and write overhead.' },
    { front: 'What is ACID?', back: 'Atomicity, Consistency, Isolation, Durability — properties ensuring reliable database transactions.' },
  ],
}

const sg = settlegrid.init({
  toolSlug: 'flashcard-api',
  pricing: { defaultCostCents: 1, methods: {
    create_cards: { costCents: 1, displayName: 'Create Flashcards' },
    get_schedule: { costCents: 1, displayName: 'Get Review Schedule' },
    get_topics: { costCents: 1, displayName: 'Get Topics' },
  }},
})

const createCards = sg.wrap(async (args: CreateInput) => {
  if (!args.topic) throw new Error('topic required')
  const key = args.topic.toLowerCase().replace(/ /g, '_')
  const cards = TOPICS[key]
  if (!cards) throw new Error(`Unknown topic. Available: ${Object.keys(TOPICS).join(', ')}`)
  const count = Math.min(args.count ?? cards.length, cards.length)
  const shuffled = [...cards].sort(() => Math.random() - 0.5).slice(0, count)
  return { topic: args.topic, cards: shuffled, count: shuffled.length, difficulty: args.difficulty ?? 'mixed' }
}, { method: 'create_cards' })

const getSchedule = sg.wrap(async (args: ScheduleInput) => {
  if (!Number.isFinite(args.total_cards)) throw new Error('total_cards required')
  const due = args.cards_due ?? args.total_cards
  // SM-2 simplified intervals
  const intervals = [1, 3, 7, 14, 30, 60]
  const dailyNew = Math.min(Math.ceil(args.total_cards / 7), 20)
  const dailyReview = Math.min(due, 50)
  return {
    total_cards: args.total_cards,
    cards_due: due,
    daily_new_cards: dailyNew,
    daily_review_cards: dailyReview,
    estimated_minutes: Math.ceil((dailyNew + dailyReview) * 0.5),
    review_intervals_days: intervals,
    algorithm: 'SM-2 (simplified)',
  }
}, { method: 'get_schedule' })

const getTopics = sg.wrap(async (_a: Record<string, never>) => {
  return { topics: Object.entries(TOPICS).map(([name, cards]) => ({ name, card_count: cards.length })), count: Object.keys(TOPICS).length }
}, { method: 'get_topics' })

export { createCards, getSchedule, getTopics }
console.log('settlegrid-flashcard-api MCP server ready')
console.log('Methods: create_cards, get_schedule, get_topics')
console.log('Pricing: 1c per call | Powered by SettleGrid')
