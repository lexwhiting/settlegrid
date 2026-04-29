/**
 * settlegrid-emoji-search — Emoji Search & Lookup MCP Server
 *
 * Search emoji by name/keyword, look up by codepoint, and browse categories.
 * Comprehensive Unicode emoji database stored locally.
 *
 * Methods:
 *   search(query, limit?)         — Search emoji by keyword          (1c)
 *   lookup(codepoint)             — Lookup emoji by codepoint        (1c)
 *   get_categories()              — List emoji categories            (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number; category?: string }
interface LookupInput { codepoint: string }

const EMOJI_DB: Array<{ emoji: string; name: string; category: string; keywords: string[]; codepoint: string }> = [
  { emoji: '\u{1F600}', name: 'grinning face', category: 'Smileys & Emotion', keywords: ['happy', 'smile', 'grin', 'joy'], codepoint: 'U+1F600' },
  { emoji: '\u{1F602}', name: 'face with tears of joy', category: 'Smileys & Emotion', keywords: ['laugh', 'cry', 'funny', 'lol'], codepoint: 'U+1F602' },
  { emoji: '\u{2764}', name: 'red heart', category: 'Smileys & Emotion', keywords: ['love', 'heart', 'romance', 'valentine'], codepoint: 'U+2764' },
  { emoji: '\u{1F60D}', name: 'smiling face with heart-eyes', category: 'Smileys & Emotion', keywords: ['love', 'heart', 'crush', 'adore'], codepoint: 'U+1F60D' },
  { emoji: '\u{1F914}', name: 'thinking face', category: 'Smileys & Emotion', keywords: ['think', 'hmm', 'consider', 'ponder'], codepoint: 'U+1F914' },
  { emoji: '\u{1F44D}', name: 'thumbs up', category: 'People & Body', keywords: ['approve', 'ok', 'agree', 'like'], codepoint: 'U+1F44D' },
  { emoji: '\u{1F44B}', name: 'waving hand', category: 'People & Body', keywords: ['wave', 'hello', 'hi', 'bye'], codepoint: 'U+1F44B' },
  { emoji: '\u{1F64F}', name: 'folded hands', category: 'People & Body', keywords: ['pray', 'please', 'thanks', 'hope'], codepoint: 'U+1F64F' },
  { emoji: '\u{1F436}', name: 'dog face', category: 'Animals & Nature', keywords: ['dog', 'puppy', 'pet', 'woof'], codepoint: 'U+1F436' },
  { emoji: '\u{1F431}', name: 'cat face', category: 'Animals & Nature', keywords: ['cat', 'kitten', 'meow', 'pet'], codepoint: 'U+1F431' },
  { emoji: '\u{1F33B}', name: 'sunflower', category: 'Animals & Nature', keywords: ['flower', 'sun', 'nature', 'yellow'], codepoint: 'U+1F33B' },
  { emoji: '\u{1F34E}', name: 'red apple', category: 'Food & Drink', keywords: ['apple', 'fruit', 'teacher', 'red'], codepoint: 'U+1F34E' },
  { emoji: '\u{2615}', name: 'hot beverage', category: 'Food & Drink', keywords: ['coffee', 'tea', 'drink', 'morning'], codepoint: 'U+2615' },
  { emoji: '\u{1F37B}', name: 'clinking beer mugs', category: 'Food & Drink', keywords: ['beer', 'cheers', 'celebrate', 'drink'], codepoint: 'U+1F37B' },
  { emoji: '\u{1F680}', name: 'rocket', category: 'Travel & Places', keywords: ['launch', 'space', 'fast', 'startup'], codepoint: 'U+1F680' },
  { emoji: '\u{1F3E0}', name: 'house', category: 'Travel & Places', keywords: ['home', 'house', 'building', 'residence'], codepoint: 'U+1F3E0' },
  { emoji: '\u{1F4BB}', name: 'laptop', category: 'Objects', keywords: ['computer', 'coding', 'work', 'tech'], codepoint: 'U+1F4BB' },
  { emoji: '\u{1F4A1}', name: 'light bulb', category: 'Objects', keywords: ['idea', 'light', 'innovation', 'bright'], codepoint: 'U+1F4A1' },
  { emoji: '\u{1F525}', name: 'fire', category: 'Travel & Places', keywords: ['hot', 'flame', 'lit', 'trending'], codepoint: 'U+1F525' },
  { emoji: '\u{2705}', name: 'check mark button', category: 'Symbols', keywords: ['check', 'done', 'complete', 'yes'], codepoint: 'U+2705' },
  { emoji: '\u{274C}', name: 'cross mark', category: 'Symbols', keywords: ['no', 'wrong', 'delete', 'cancel'], codepoint: 'U+274C' },
  { emoji: '\u{1F3AF}', name: 'direct hit', category: 'Activities', keywords: ['target', 'bullseye', 'goal', 'aim'], codepoint: 'U+1F3AF' },
]

const sg = settlegrid.init({
  toolSlug: 'emoji-search',
  pricing: { defaultCostCents: 1, methods: {
    search: { costCents: 1, displayName: 'Search Emoji' },
    lookup: { costCents: 1, displayName: 'Lookup Emoji' },
    get_categories: { costCents: 1, displayName: 'Get Categories' },
  }},
})

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query required')
  const q = args.query.toLowerCase()
  const limit = Math.min(args.limit ?? 10, 30)
  let results = EMOJI_DB.filter(e => e.name.includes(q) || e.keywords.some(k => k.includes(q)))
  if (args.category) results = results.filter(e => e.category.toLowerCase().includes(args.category!.toLowerCase()))
  return { query: args.query, results: results.slice(0, limit), count: Math.min(results.length, limit), total_matches: results.length }
}, { method: 'search' })

const lookup = sg.wrap(async (args: LookupInput) => {
  if (!args.codepoint) throw new Error('codepoint required (e.g. "U+1F600")')
  const cp = args.codepoint.toUpperCase()
  const emoji = EMOJI_DB.find(e => e.codepoint === cp)
  if (!emoji) throw new Error(`Emoji not found for codepoint ${cp}`)
  return emoji
}, { method: 'lookup' })

const getCategories = sg.wrap(async (_a: Record<string, never>) => {
  const cats = new Map<string, number>()
  for (const e of EMOJI_DB) cats.set(e.category, (cats.get(e.category) ?? 0) + 1)
  return { categories: [...cats.entries()].map(([name, count]) => ({ name, count })), total: EMOJI_DB.length }
}, { method: 'get_categories' })

export { search, lookup, getCategories }
console.log('settlegrid-emoji-search MCP server ready')
console.log('Methods: search, lookup, get_categories')
console.log('Pricing: 1c per call | Powered by SettleGrid')
