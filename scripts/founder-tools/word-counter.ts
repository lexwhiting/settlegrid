/**
 * settlegrid-word-counter — Text Statistics MCP Server
 *
 * Takes text input and returns comprehensive text statistics: word count,
 * character count, sentence count, paragraph count, reading time, and
 * basic language detection. Useful for content agents, editors, and
 * text processing pipelines.
 *
 * Methods:
 *   count_words(text)       — full text statistics (1 cent)
 *   reading_time(text, wpm?) — estimated reading time (1 cent)
 *   detect_language(text)   — basic language detection (1 cent)
 *
 * Pricing: 1 cent per call
 * Category: nlp
 *
 * Deploy: Vercel, Railway, or any Node.js host
 *   SETTLEGRID_TOOL_SLUG=word-counter npx tsx word-counter.ts
 */

import { settlegrid } from '@settlegrid/mcp'

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface CountInput {
  text: string
}

interface ReadingTimeInput {
  text: string
  wpm?: number
}

interface LanguageIndicator {
  language: string
  code: string
  markers: string[]
}

/* -------------------------------------------------------------------------- */
/*  SettleGrid init                                                           */
/* -------------------------------------------------------------------------- */

const sg = settlegrid.init({
  toolSlug: process.env.SETTLEGRID_TOOL_SLUG || 'word-counter',
  pricing: {
    defaultCostCents: 1,
    methods: {
      count_words: { costCents: 1, displayName: 'Count Words' },
      reading_time: { costCents: 1, displayName: 'Reading Time' },
      detect_language: { costCents: 1, displayName: 'Detect Language' },
    },
  },
})

/* -------------------------------------------------------------------------- */
/*  Language detection markers                                                */
/* -------------------------------------------------------------------------- */

const LANGUAGE_INDICATORS: LanguageIndicator[] = [
  { language: 'English', code: 'en', markers: ['the', 'and', 'is', 'are', 'was', 'were', 'have', 'has', 'this', 'that', 'with', 'from', 'they', 'been', 'which'] },
  { language: 'Spanish', code: 'es', markers: ['el', 'la', 'los', 'las', 'de', 'en', 'que', 'por', 'con', 'una', 'para', 'como', 'pero', 'sus', 'del'] },
  { language: 'French', code: 'fr', markers: ['le', 'la', 'les', 'des', 'une', 'est', 'dans', 'que', 'pour', 'qui', 'sur', 'avec', 'pas', 'sont', 'cette'] },
  { language: 'German', code: 'de', markers: ['der', 'die', 'das', 'und', 'ist', 'von', 'den', 'mit', 'sich', 'des', 'auf', 'ein', 'eine', 'nicht', 'auch'] },
  { language: 'Portuguese', code: 'pt', markers: ['de', 'que', 'em', 'para', 'com', 'uma', 'por', 'como', 'mais', 'dos', 'das', 'foi', 'pelo', 'sua', 'seus'] },
  { language: 'Italian', code: 'it', markers: ['di', 'che', 'della', 'del', 'nella', 'sono', 'dalla', 'anche', 'alla', 'questo', 'questa', 'molto', 'degli', 'delle', 'hanno'] },
  { language: 'Dutch', code: 'nl', markers: ['de', 'het', 'van', 'een', 'en', 'dat', 'die', 'voor', 'niet', 'met', 'zijn', 'ook', 'maar', 'wordt', 'nog'] },
]

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function countSentences(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  return sentences.length
}

function countParagraphs(text: string): number {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0)
  return Math.max(paragraphs.length, 1)
}

function countSyllables(word: string): number {
  const lower = word.toLowerCase().replace(/[^a-z]/g, '')
  if (lower.length <= 3) return 1
  let count = lower.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '')
    .match(/[aeiouy]{1,2}/g)
  return count ? count.length : 1
}

function detectLanguage(text: string): { language: string; code: string; confidence: number } {
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 1)
  if (words.length === 0) {
    return { language: 'Unknown', code: 'und', confidence: 0 }
  }

  const wordSet = new Set(words)
  let bestMatch = { language: 'Unknown', code: 'und', confidence: 0 }

  for (const indicator of LANGUAGE_INDICATORS) {
    const matchCount = indicator.markers.filter((marker) => wordSet.has(marker)).length
    const confidence = matchCount / indicator.markers.length
    if (confidence > bestMatch.confidence) {
      bestMatch = { language: indicator.language, code: indicator.code, confidence }
    }
  }

  // Check for CJK characters
  const cjkCount = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const hiraganaCount = (text.match(/[\u3040-\u309f]/g) || []).length
  const hangulCount = (text.match(/[\uac00-\ud7af]/g) || []).length
  const arabicCount = (text.match(/[\u0600-\u06ff]/g) || []).length

  const totalChars = text.length
  if (totalChars > 0) {
    if (hiraganaCount / totalChars > 0.1) return { language: 'Japanese', code: 'ja', confidence: 0.8 }
    if (hangulCount / totalChars > 0.1) return { language: 'Korean', code: 'ko', confidence: 0.8 }
    if (cjkCount / totalChars > 0.1) return { language: 'Chinese', code: 'zh', confidence: 0.7 }
    if (arabicCount / totalChars > 0.1) return { language: 'Arabic', code: 'ar', confidence: 0.8 }
  }

  // Require at least some confidence for European languages
  if (bestMatch.confidence < 0.1) {
    return { language: 'Unknown', code: 'und', confidence: 0 }
  }

  return { ...bestMatch, confidence: Math.round(bestMatch.confidence * 100) / 100 }
}

/* -------------------------------------------------------------------------- */
/*  Wrapped handlers                                                          */
/* -------------------------------------------------------------------------- */

const countWords = sg.wrap(async (args: CountInput) => {
  if (!args.text || typeof args.text !== 'string') {
    throw new Error('text is required and must be a string')
  }

  const text = args.text
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  const wordCount = words.length
  const charCount = text.length
  const charCountNoSpaces = text.replace(/\s/g, '').length
  const sentenceCount = countSentences(text)
  const paragraphCount = countParagraphs(text)
  const lineCount = text.split('\n').length
  const avgWordLength = wordCount > 0
    ? Math.round((charCountNoSpaces / wordCount) * 10) / 10
    : 0
  const avgSentenceLength = sentenceCount > 0
    ? Math.round((wordCount / sentenceCount) * 10) / 10
    : 0

  // Unique words
  const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, '')))
  uniqueWords.delete('')
  const uniqueWordCount = uniqueWords.size
  const lexicalDiversity = wordCount > 0
    ? Math.round((uniqueWordCount / wordCount) * 100) / 100
    : 0

  // Reading time (average 238 wpm for adults)
  const readingTimeMinutes = Math.round((wordCount / 238) * 10) / 10
  const speakingTimeMinutes = Math.round((wordCount / 150) * 10) / 10

  // Basic readability (Flesch-Kincaid approximation)
  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0)
  const avgSyllablesPerWord = wordCount > 0
    ? Math.round((totalSyllables / wordCount) * 10) / 10
    : 0

  return {
    word_count: wordCount,
    character_count: charCount,
    character_count_no_spaces: charCountNoSpaces,
    sentence_count: sentenceCount,
    paragraph_count: paragraphCount,
    line_count: lineCount,
    unique_word_count: uniqueWordCount,
    lexical_diversity: lexicalDiversity,
    avg_word_length: avgWordLength,
    avg_sentence_length: avgSentenceLength,
    avg_syllables_per_word: avgSyllablesPerWord,
    reading_time_minutes: readingTimeMinutes,
    speaking_time_minutes: speakingTimeMinutes,
  }
}, { method: 'count_words' })

const readingTime = sg.wrap(async (args: ReadingTimeInput) => {
  if (!args.text || typeof args.text !== 'string') {
    throw new Error('text is required and must be a string')
  }

  const wpm = Math.min(Math.max(args.wpm ?? 238, 50), 1000)
  const words = args.text.split(/\s+/).filter((w) => w.length > 0)
  const wordCount = words.length
  const minutes = wordCount / wpm
  const seconds = Math.round(minutes * 60)

  const formattedTime = minutes < 1
    ? `${seconds} seconds`
    : minutes < 60
      ? `${Math.ceil(minutes)} minute${Math.ceil(minutes) !== 1 ? 's' : ''}`
      : `${Math.floor(minutes / 60)} hour${Math.floor(minutes / 60) !== 1 ? 's' : ''} ${Math.round(minutes % 60)} minutes`

  return {
    word_count: wordCount,
    wpm_used: wpm,
    reading_time_minutes: Math.round(minutes * 10) / 10,
    reading_time_seconds: seconds,
    formatted: formattedTime,
  }
}, { method: 'reading_time' })

const detectLang = sg.wrap(async (args: CountInput) => {
  if (!args.text || typeof args.text !== 'string') {
    throw new Error('text is required and must be a string')
  }

  const result = detectLanguage(args.text)
  const sampleWords = args.text.split(/\s+/).slice(0, 10).join(' ')

  return {
    language: result.language,
    language_code: result.code,
    confidence: result.confidence,
    sample: sampleWords.length > 80 ? sampleWords.substring(0, 80) + '...' : sampleWords,
    note: 'Basic heuristic detection. For production accuracy, use a dedicated NLP service.',
  }
}, { method: 'detect_language' })

/* -------------------------------------------------------------------------- */
/*  Exports                                                                   */
/* -------------------------------------------------------------------------- */

export { countWords, readingTime, detectLang }

console.log('settlegrid-word-counter MCP server ready')
console.log('Methods: count_words, reading_time, detect_language')
console.log('Pricing: 1 cent per call | Powered by SettleGrid')
