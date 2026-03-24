/**
 * settlegrid-word-counter — Word Counter MCP Server
 *
 * Counts words and characters locally with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   count_words(text) — word count (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TextInput { text: string }

const sg = settlegrid.init({
  toolSlug: 'word-counter',
  pricing: { defaultCostCents: 1, methods: { count_words: { costCents: 1, displayName: 'Count Words' } } },
})

const countWords = sg.wrap(async (args: TextInput) => {
  if (!args.text && args.text !== '') throw new Error('text is required')
  const text = args.text.trim()
  const words = text ? text.split(/\s+/).length : 0
  const chars = text.length
  const chars_no_spaces = text.replace(/\s/g, '').length
  const sentences = text ? (text.match(/[.!?]+/g) || []).length || 1 : 0
  const paragraphs = text ? text.split(/\n\n+/).filter(p => p.trim()).length : 0
  const reading_time_min = Math.ceil(words / 200)
  const speaking_time_min = Math.ceil(words / 130)
  return { words, characters: chars, characters_no_spaces: chars_no_spaces, sentences, paragraphs, reading_time_min, speaking_time_min, avg_word_length: words > 0 ? Math.round(chars_no_spaces / words * 10) / 10 : 0 }
}, { method: 'count_words' })

export { countWords }

console.log('settlegrid-word-counter MCP server ready')
console.log('Methods: count_words')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
