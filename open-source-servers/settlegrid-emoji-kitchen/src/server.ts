/**
 * settlegrid-emoji-kitchen — Emoji Combination MCP Server
 *
 * Combines emoji pairs, provides emoji metadata, and suggests
 * related emoji based on categories and skin tones.
 *
 * Methods:
 *   combine(emoji_a, emoji_b)     — Combine two emoji               (1c)
 *   get_info(emoji)               — Get emoji metadata              (1c)
 *   search(query)                 — Search emoji by keyword         (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface CombineInput { emoji_a: string; emoji_b: string }
interface GetInfoInput { emoji: string }
interface SearchInput { query: string; limit?: number }

const EMOJI_DATA: Record<string, { name: string; category: string; keywords: string[] }> = {
  '\u{1F600}': { name: 'grinning face', category: 'Smileys', keywords: ['happy', 'smile', 'grin'] },
  '\u{2764}': { name: 'red heart', category: 'Smileys', keywords: ['love', 'heart', 'romance'] },
  '\u{1F525}': { name: 'fire', category: 'Travel', keywords: ['hot', 'fire', 'flame', 'lit'] },
  '\u{1F4A9}': { name: 'pile of poo', category: 'Smileys', keywords: ['poo', 'poop', 'funny'] },
  '\u{1F60D}': { name: 'heart eyes', category: 'Smileys', keywords: ['love', 'heart', 'eyes', 'adore'] },
  '\u{1F44D}': { name: 'thumbs up', category: 'People', keywords: ['approve', 'ok', 'agree', 'yes'] },
  '\u{1F680}': { name: 'rocket', category: 'Travel', keywords: ['launch', 'space', 'fast', 'ship'] },
  '\u{1F31F}': { name: 'glowing star', category: 'Travel', keywords: ['star', 'sparkle', 'shine'] },
  '\u{1F338}': { name: 'cherry blossom', category: 'Nature', keywords: ['flower', 'spring', 'japan'] },
  '\u{1F34E}': { name: 'red apple', category: 'Food', keywords: ['apple', 'fruit', 'teacher'] },
  '\u{2615}': { name: 'hot beverage', category: 'Food', keywords: ['coffee', 'tea', 'drink', 'warm'] },
  '\u{1F308}': { name: 'rainbow', category: 'Travel', keywords: ['rainbow', 'colors', 'pride'] },
  '\u{1F4BB}': { name: 'laptop', category: 'Objects', keywords: ['computer', 'coding', 'work'] },
  '\u{1F3B5}': { name: 'musical note', category: 'Objects', keywords: ['music', 'note', 'song'] },
  '\u{1F436}': { name: 'dog face', category: 'Nature', keywords: ['dog', 'puppy', 'pet'] },
  '\u{1F431}': { name: 'cat face', category: 'Nature', keywords: ['cat', 'kitten', 'pet'] },
}

const COMBINATIONS: Record<string, { result: string; name: string }> = {
  '\u{2764}+\u{1F525}': { result: '\u{2764}\u{200D}\u{1F525}', name: 'heart on fire' },
  '\u{1F600}+\u{1F44D}': { result: '\u{1F44D}', name: 'happy approval' },
  '\u{1F431}+\u{1F436}': { result: '\u{1F43E}', name: 'paw prints (pets together)' },
  '\u{1F680}+\u{1F31F}': { result: '\u{1F30C}', name: 'milky way (space)' },
  '\u{2615}+\u{1F338}': { result: '\u{1FAD6}', name: 'teapot (flower tea)' },
}

const sg = settlegrid.init({
  toolSlug: 'emoji-kitchen',
  pricing: { defaultCostCents: 1, methods: {
    combine: { costCents: 1, displayName: 'Combine Emoji' },
    get_info: { costCents: 1, displayName: 'Get Emoji Info' },
    search: { costCents: 1, displayName: 'Search Emoji' },
  }},
})

const combine = sg.wrap(async (args: CombineInput) => {
  if (!args.emoji_a || !args.emoji_b) throw new Error('emoji_a and emoji_b required')
  const key1 = `${args.emoji_a}+${args.emoji_b}`
  const key2 = `${args.emoji_b}+${args.emoji_a}`
  const combo = COMBINATIONS[key1] ?? COMBINATIONS[key2]
  if (combo) return { emoji_a: args.emoji_a, emoji_b: args.emoji_b, result: combo.result, name: combo.name, found: true }
  return { emoji_a: args.emoji_a, emoji_b: args.emoji_b, result: args.emoji_a + args.emoji_b, name: 'concatenated', found: false, note: 'No kitchen combination found, showing concatenation' }
}, { method: 'combine' })

const getInfo = sg.wrap(async (args: GetInfoInput) => {
  if (!args.emoji) throw new Error('emoji required')
  const info = EMOJI_DATA[args.emoji]
  if (!info) {
    const codePoints = [...args.emoji].map(c => `U+${c.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}`).join(' ')
    return { emoji: args.emoji, codepoints: codePoints, found: false }
  }
  const codePoints = [...args.emoji].map(c => `U+${c.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}`).join(' ')
  return { emoji: args.emoji, codepoints: codePoints, ...info, found: true }
}, { method: 'get_info' })

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query required')
  const q = args.query.toLowerCase()
  const limit = Math.min(args.limit ?? 10, 20)
  const results = Object.entries(EMOJI_DATA)
    .filter(([, info]) => info.name.includes(q) || info.keywords.some(k => k.includes(q)) || info.category.toLowerCase().includes(q))
    .slice(0, limit)
    .map(([emoji, info]) => ({ emoji, ...info }))
  return { query: args.query, results, count: results.length }
}, { method: 'search' })

export { combine, getInfo, search }
console.log('settlegrid-emoji-kitchen MCP server ready')
console.log('Methods: combine, get_info, search')
console.log('Pricing: 1c per call | Powered by SettleGrid')
