/**
 * settlegrid-plagiarism-check — Plagiarism Text Analysis MCP Server
 *
 * Plagiarism Text Analysis tools with SettleGrid billing.
 * Pricing: 1-2c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

interface CheckInput { text: string; compare_to?: string }
interface GetStatsInput { text: string }

const sg = settlegrid.init({ toolSlug: 'plagiarism-check', pricing: { defaultCostCents: 1, methods: {
  analyze_text: { costCents: 1, displayName: 'Analyze Text' },
  compare_texts: { costCents: 1, displayName: 'Compare Texts' },
  get_readability: { costCents: 1, displayName: 'Get Readability' },
}}})

function nGrams(text: string, n: number): Set<string> {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  const grams = new Set<string>()
  for (let i = 0; i <= words.length - n; i++) grams.add(words.slice(i, i + n).join(' '))
  return grams
}

const analyzeText = sg.wrap(async (args: CheckInput) => {
  if (!args.text) throw new Error('text required')
  const words = args.text.split(/\s+/)
  const sentences = args.text.split(/[.!?]+/).filter(s => s.trim())
  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z]/g, '')))
  const avgSentenceLen = words.length / Math.max(sentences.length, 1)
  return { word_count: words.length, sentence_count: sentences.length, unique_words: uniqueWords.size, vocabulary_richness: Math.round((uniqueWords.size / Math.max(words.length, 1)) * 100) / 100, avg_sentence_length: Math.round(avgSentenceLen * 10) / 10, avg_word_length: Math.round(words.reduce((s, w) => s + w.length, 0) / Math.max(words.length, 1) * 10) / 10 }
}, { method: 'analyze_text' })

const compareTexts = sg.wrap(async (args: { text_a: string; text_b: string }) => {
  if (!args.text_a || !args.text_b) throw new Error('text_a and text_b required')
  const grams3A = nGrams(args.text_a, 3)
  const grams3B = nGrams(args.text_b, 3)
  let overlap = 0
  for (const g of grams3A) if (grams3B.has(g)) overlap++
  const similarity = Math.round((overlap / Math.max(Math.max(grams3A.size, grams3B.size), 1)) * 100)
  return { similarity_pct: similarity, matching_trigrams: overlap, total_trigrams_a: grams3A.size, total_trigrams_b: grams3B.size, assessment: similarity > 50 ? 'High similarity' : similarity > 20 ? 'Some similarity' : 'Low similarity' }
}, { method: 'compare_texts' })

const getReadability = sg.wrap(async (args: GetStatsInput) => {
  if (!args.text) throw new Error('text required')
  const words = args.text.split(/\s+/)
  const sentences = args.text.split(/[.!?]+/).filter(s => s.trim())
  const syllables = words.reduce((s, w) => s + Math.max(1, w.replace(/[^aeiouy]/gi, '').length), 0)
  const fk = 0.39 * (words.length / Math.max(sentences.length, 1)) + 11.8 * (syllables / Math.max(words.length, 1)) - 15.59
  return { flesch_kincaid_grade: Math.round(Math.max(0, fk) * 10) / 10, words: words.length, sentences: sentences.length, avg_syllables_per_word: Math.round(syllables / Math.max(words.length, 1) * 10) / 10, reading_level: fk < 6 ? 'Elementary' : fk < 10 ? 'Middle School' : fk < 13 ? 'High School' : 'College' }
}, { method: 'get_readability' })

export { analyzeText, compareTexts, getReadability }
console.log('settlegrid-plagiarism-check MCP server ready | Powered by SettleGrid')
