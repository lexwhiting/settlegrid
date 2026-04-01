/**
 * settlegrid-translation — Translation MCP Server
 *
 * Text translation via the free MyMemory Translation API.
 * No API key needed — uses the public tier.
 *
 * Methods:
 *   translate(text, from, to)     — Translate text between languages   (2¢)
 *   detect_language(text)         — Detect the language of text        (1¢)
 *   supported_languages()         — List supported language codes       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TranslateInput {
  text: string
  from: string
  to: string
}

interface DetectLanguageInput {
  text: string
}

interface SupportedLanguagesInput {
  // No input needed
}

interface MyMemoryResponse {
  responseData: {
    translatedText: string
    match: number
  }
  quotaFinished: boolean
  responseDetails: string
  responseStatus: number
  responderId: string | null
  matches: Array<{
    id: string
    segment: string
    translation: string
    source: string
    target: string
    quality: string
    reference: string | null
    'usage-count': number
    subject: string
    'created-by': string
    'last-updated-by': string
    'create-date': string
    'last-update-date': string
    match: number
  }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const USER_AGENT = 'settlegrid-translation/1.0 (contact@settlegrid.ai)'

// ISO 639-1 language codes supported by MyMemory
const LANGUAGES: Record<string, string> = {
  af: 'Afrikaans', sq: 'Albanian', am: 'Amharic', ar: 'Arabic', hy: 'Armenian',
  az: 'Azerbaijani', eu: 'Basque', be: 'Belarusian', bn: 'Bengali', bs: 'Bosnian',
  bg: 'Bulgarian', ca: 'Catalan', zh: 'Chinese', hr: 'Croatian', cs: 'Czech',
  da: 'Danish', nl: 'Dutch', en: 'English', et: 'Estonian', fi: 'Finnish',
  fr: 'French', gl: 'Galician', ka: 'Georgian', de: 'German', el: 'Greek',
  gu: 'Gujarati', ht: 'Haitian Creole', ha: 'Hausa', he: 'Hebrew', hi: 'Hindi',
  hu: 'Hungarian', is: 'Icelandic', ig: 'Igbo', id: 'Indonesian', ga: 'Irish',
  it: 'Italian', ja: 'Japanese', kn: 'Kannada', kk: 'Kazakh', ko: 'Korean',
  ku: 'Kurdish', ky: 'Kyrgyz', la: 'Latin', lv: 'Latvian', lt: 'Lithuanian',
  lb: 'Luxembourgish', mk: 'Macedonian', ms: 'Malay', ml: 'Malayalam', mt: 'Maltese',
  mi: 'Maori', mr: 'Marathi', mn: 'Mongolian', ne: 'Nepali', no: 'Norwegian',
  ps: 'Pashto', fa: 'Persian', pl: 'Polish', pt: 'Portuguese', pa: 'Punjabi',
  ro: 'Romanian', ru: 'Russian', sr: 'Serbian', sk: 'Slovak', sl: 'Slovenian',
  so: 'Somali', es: 'Spanish', sw: 'Swahili', sv: 'Swedish', tl: 'Tagalog',
  ta: 'Tamil', te: 'Telugu', th: 'Thai', tr: 'Turkish', uk: 'Ukrainian',
  ur: 'Urdu', uz: 'Uzbek', vi: 'Vietnamese', cy: 'Welsh', yi: 'Yiddish',
  zu: 'Zulu',
}

const LANGUAGE_CODES = new Set(Object.keys(LANGUAGES))

const MAX_TEXT_LENGTH = 5_000 // MyMemory free tier limit

async function fetchWithTimeout<T>(url: string, timeoutMs: number = 10_000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Translation API error ${res.status}: ${body.slice(0, 200)}`)
    }
    return res.json() as Promise<T>
  } finally {
    clearTimeout(timer)
  }
}

function validateLanguageCode(code: string, paramName: string): string {
  const normalized = code.toLowerCase().trim()
  if (!LANGUAGE_CODES.has(normalized)) {
    // Try to match by name
    const byName = Object.entries(LANGUAGES).find(([, name]) => name.toLowerCase() === normalized)
    if (byName) return byName[0]
    throw new Error(`Unsupported language "${code}" for ${paramName}. Use ISO 639-1 codes (e.g. "en", "es", "fr"). Call supported_languages() for the full list.`)
  }
  return normalized
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'translation-engine',
  pricing: {
    defaultCostCents: 1,
    methods: {
      translate: { costCents: 2, displayName: 'Translate Text' },
      detect_language: { costCents: 1, displayName: 'Detect Language' },
      supported_languages: { costCents: 1, displayName: 'Supported Languages' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const translate = sg.wrap(async (args: TranslateInput) => {
  if (!args.text || typeof args.text !== 'string') {
    throw new Error('text is required — provide the text to translate')
  }
  if (!args.from || typeof args.from !== 'string') {
    throw new Error('from is required — provide the source language code (e.g. "en")')
  }
  if (!args.to || typeof args.to !== 'string') {
    throw new Error('to is required — provide the target language code (e.g. "es")')
  }

  const text = args.text.trim()
  if (text.length === 0) {
    throw new Error('text cannot be empty')
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`Text too long (${text.length} chars). Maximum is ${MAX_TEXT_LENGTH} characters per request. Split into smaller chunks.`)
  }

  const from = validateLanguageCode(args.from, 'from')
  const to = validateLanguageCode(args.to, 'to')

  if (from === to) {
    return {
      translatedText: text,
      sourceLanguage: { code: from, name: LANGUAGES[from] },
      targetLanguage: { code: to, name: LANGUAGES[to] },
      confidence: 1.0,
      characterCount: text.length,
      note: 'Source and target languages are the same — no translation needed',
    }
  }

  const encodedText = encodeURIComponent(text)
  const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=${from}|${to}`

  const data = await fetchWithTimeout<MyMemoryResponse>(url)

  if (data.responseStatus !== 200) {
    throw new Error(`Translation failed: ${data.responseDetails || 'Unknown error'}`)
  }

  if (data.quotaFinished) {
    throw new Error('Translation quota exceeded — try again later or use shorter text')
  }

  // Get alternative translations from matches
  const alternatives = data.matches
    .filter(m => m.match >= 0.5 && m.translation !== data.responseData.translatedText)
    .slice(0, 3)
    .map(m => ({
      translation: m.translation,
      confidence: m.match,
      source: m['created-by'],
    }))

  return {
    translatedText: data.responseData.translatedText,
    sourceLanguage: { code: from, name: LANGUAGES[from] },
    targetLanguage: { code: to, name: LANGUAGES[to] },
    confidence: data.responseData.match,
    characterCount: text.length,
    alternatives: alternatives.length > 0 ? alternatives : undefined,
  }
}, { method: 'translate' })

const detectLanguage = sg.wrap(async (args: DetectLanguageInput) => {
  if (!args.text || typeof args.text !== 'string') {
    throw new Error('text is required — provide the text to analyze')
  }

  const text = args.text.trim()
  if (text.length === 0) {
    throw new Error('text cannot be empty')
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`Text too long (${text.length} chars). Maximum is ${MAX_TEXT_LENGTH} characters.`)
  }

  // Use MyMemory with autodetect by translating from autodetect to English
  // The API returns the detected source language in the match results
  const encodedText = encodeURIComponent(text.slice(0, 500)) // Use first 500 chars for detection
  const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=autodetect|en`

  const data = await fetchWithTimeout<MyMemoryResponse>(url)

  if (data.responseStatus !== 200) {
    throw new Error(`Language detection failed: ${data.responseDetails || 'Unknown error'}`)
  }

  // Extract detected language from response details
  // MyMemory returns something like "TRANSLATED VIA LANGUAGE WEAVER" or includes source lang info
  // The most reliable way is to check the matches
  let detectedCode: string | null = null
  let detectedConfidence = 0

  for (const match of data.matches) {
    if (match.source && LANGUAGE_CODES.has(match.source)) {
      detectedCode = match.source
      detectedConfidence = match.match
      break
    }
  }

  // Fallback: try to extract from responseDetails
  if (!detectedCode) {
    const detailMatch = data.responseDetails?.match(/\b([a-z]{2})\b/)
    if (detailMatch && LANGUAGE_CODES.has(detailMatch[1])) {
      detectedCode = detailMatch[1]
      detectedConfidence = 0.5
    }
  }

  // If still no detection, do a heuristic based on script
  if (!detectedCode) {
    detectedCode = heuristicDetect(text)
    detectedConfidence = 0.3
  }

  return {
    detectedLanguage: detectedCode ? {
      code: detectedCode,
      name: LANGUAGES[detectedCode] ?? detectedCode,
    } : null,
    confidence: detectedConfidence,
    sampleText: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
    characterCount: text.length,
  }
}, { method: 'detect_language' })

function heuristicDetect(text: string): string {
  // Basic script-based detection as fallback
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh'
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja'
  if (/[\uac00-\ud7af]/.test(text)) return 'ko'
  if (/[\u0600-\u06ff]/.test(text)) return 'ar'
  if (/[\u0590-\u05ff]/.test(text)) return 'he'
  if (/[\u0e00-\u0e7f]/.test(text)) return 'th'
  if (/[\u0900-\u097f]/.test(text)) return 'hi'
  if (/[\u0400-\u04ff]/.test(text)) return 'ru'
  if (/[\u1100-\u11ff]/.test(text)) return 'ko'
  // Latin script — default to English
  return 'en'
}

const supportedLanguages = sg.wrap(async (_args: SupportedLanguagesInput) => {
  const languageList = Object.entries(LANGUAGES)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    count: languageList.length,
    languages: languageList,
    note: 'Use ISO 639-1 two-letter codes in the "from" and "to" parameters of translate()',
  }
}, { method: 'supported_languages' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { translate, detectLanguage, supportedLanguages }

console.log('settlegrid-translation MCP server ready')
console.log('Methods: translate, detect_language, supported_languages')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
