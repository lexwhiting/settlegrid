/**
 * settlegrid-text-tools — Text Manipulation MCP Server
 *
 * Local computation — no external API needed.
 *
 * Methods:
 *   word_count(text)         — Count words, sentences, paragraphs  (1¢)
 *   readability_score(text)  — Flesch-Kincaid readability          (1¢)
 *   extract_emails(text)     — Extract email addresses             (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TextInput {
  text: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MAX_SIZE = 100000

function validateText(text: unknown): string {
  if (!text || typeof text !== 'string') throw new Error('text is required')
  if (text.length > MAX_SIZE) throw new Error(`Text too large (max ${MAX_SIZE} chars)`)
  return text
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (w.length <= 3) return 1
  let count = 0
  const vowels = 'aeiouy'
  let prevVowel = false
  for (const char of w) {
    const isVowel = vowels.includes(char)
    if (isVowel && !prevVowel) count++
    prevVowel = isVowel
  }
  if (w.endsWith('e') && count > 1) count--
  return Math.max(1, count)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'text-tools',
  pricing: {
    defaultCostCents: 1,
    methods: {
      word_count: { costCents: 1, displayName: 'Word Count' },
      readability_score: { costCents: 1, displayName: 'Readability Score' },
      extract_emails: { costCents: 1, displayName: 'Extract Emails' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const wordCount = sg.wrap(async (args: TextInput) => {
  const text = validateText(args.text)
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0)

  return {
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
    words: words.length,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    averageWordLength: words.length > 0
      ? Math.round((words.reduce((s, w) => s + w.length, 0) / words.length) * 10) / 10
      : 0,
    averageSentenceLength: sentences.length > 0
      ? Math.round(words.length / sentences.length * 10) / 10
      : 0,
    readingTimeMinutes: Math.max(1, Math.round(words.length / 200)),
  }
}, { method: 'word_count' })

const readabilityScore = sg.wrap(async (args: TextInput) => {
  const text = validateText(args.text)
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)

  if (words.length < 10) throw new Error('Text must contain at least 10 words for readability analysis')

  const totalSyllables = words.reduce((s, w) => s + countSyllables(w), 0)
  const wordsPerSentence = words.length / Math.max(1, sentences.length)
  const syllablesPerWord = totalSyllables / words.length

  // Flesch Reading Ease
  const fleschEase = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord
  // Flesch-Kincaid Grade Level
  const gradeLevel = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59

  let readabilityLevel: string
  if (fleschEase >= 90) readabilityLevel = 'Very Easy (5th grade)'
  else if (fleschEase >= 80) readabilityLevel = 'Easy (6th grade)'
  else if (fleschEase >= 70) readabilityLevel = 'Fairly Easy (7th grade)'
  else if (fleschEase >= 60) readabilityLevel = 'Standard (8th-9th grade)'
  else if (fleschEase >= 50) readabilityLevel = 'Fairly Difficult (10th-12th grade)'
  else if (fleschEase >= 30) readabilityLevel = 'Difficult (College level)'
  else readabilityLevel = 'Very Difficult (Professional)'

  return {
    fleschReadingEase: Math.round(fleschEase * 10) / 10,
    fleschKincaidGrade: Math.round(gradeLevel * 10) / 10,
    level: readabilityLevel,
    stats: {
      words: words.length,
      sentences: sentences.length,
      syllables: totalSyllables,
      avgWordsPerSentence: Math.round(wordsPerSentence * 10) / 10,
      avgSyllablesPerWord: Math.round(syllablesPerWord * 10) / 10,
    },
  }
}, { method: 'readability_score' })

const extractEmails = sg.wrap(async (args: TextInput) => {
  const text = validateText(args.text)
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const matches = text.match(emailRegex) || []
  const unique = [...new Set(matches)]

  const domains = unique.reduce((acc, email) => {
    const domain = email.split('@')[1]
    acc[domain] = (acc[domain] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return {
    total: matches.length,
    unique: unique.length,
    emails: unique.slice(0, 100),
    domains: Object.entries(domains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([domain, count]) => ({ domain, count })),
  }
}, { method: 'extract_emails' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { wordCount, readabilityScore, extractEmails }

console.log('settlegrid-text-tools MCP server ready')
console.log('Methods: word_count, readability_score, extract_emails')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
