/**
 * Content filtering for review moderation.
 *
 * Runs entirely in-process with zero external dependencies.
 * Checks for profanity/slurs, spam patterns, minimum quality, and PII.
 */

export interface ContentFilterResult {
  passed: boolean
  reasons: string[] // e.g., ['profanity_detected', 'spam_pattern']
}

// ── Profanity word list ───────────────────────────────────────────────────────
// Focus on clear slurs and hate speech. Mild profanity is allowed in context.
const PROFANITY_WORDS: string[] = [
  'asshole', 'bastard', 'bitch', 'bullshit', 'cocksucker', 'cunt',
  'damn', 'dick', 'dumbass', 'fag', 'faggot', 'fuck', 'fucker',
  'fucking', 'goddamn', 'horseshit', 'jackass', 'motherfucker',
  'nigger', 'nigga', 'piss', 'pussy', 'retard', 'retarded',
  'shit', 'shitty', 'slut', 'twat', 'whore',
  // Slurs and hate speech
  'chink', 'gook', 'kike', 'spic', 'wetback', 'beaner',
  'cracker', 'honky', 'tranny', 'dyke', 'coon', 'raghead',
  'towelhead', 'zipperhead', 'jap', 'gypsy', 'paki',
  'negro', 'darkie', 'halfbreed', 'mongrel',
]

// Leet-speak substitution map
const LEET_MAP: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '3': 'e',
  '1': 'i',
  '!': 'i',
  '0': 'o',
  '5': 's',
  '$': 's',
  '7': 't',
  '+': 't',
}

/**
 * Normalizes text by replacing leet-speak characters and
 * collapsing repeated characters, then lowercasing.
 */
function normalizeLeet(text: string): string {
  let result = text.toLowerCase()
  for (const [leet, char] of Object.entries(LEET_MAP)) {
    // Escape the special regex characters in the leet key
    const escaped = leet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(escaped, 'g'), char)
  }
  // Collapse repeated characters (e.g., "fuuuuck" -> "fuck")
  result = result.replace(/(.)\1{2,}/g, '$1')
  // Remove common separators used to disguise words
  result = result.replace(/[_\-.\s]/g, '')
  return result
}

/**
 * Checks text for profanity using exact word matching against
 * the normalized form. Uses word boundary matching on the
 * original and normalized forms to reduce false positives.
 */
function checkProfanity(text: string): string[] {
  const reasons: string[] = []
  const normalized = normalizeLeet(text)
  const lowerText = text.toLowerCase()

  for (const word of PROFANITY_WORDS) {
    // Check raw text with word boundaries
    const wordBoundary = new RegExp(`\\b${word}\\b`, 'i')
    if (wordBoundary.test(lowerText)) {
      reasons.push('profanity_detected')
      break
    }
    // Check normalized (leet-speak) text
    if (normalized.includes(word)) {
      reasons.push('profanity_detected')
      break
    }
  }

  return reasons
}

// ── Spam detection ────────────────────────────────────────────────────────────

const URL_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+/i
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/

function checkSpam(text: string): string[] {
  const reasons: string[] = []

  // All caps: >80% uppercase (ignore spaces/punctuation)
  const letters = text.replace(/[^a-zA-Z]/g, '')
  if (letters.length > 5) {
    const uppercaseCount = (letters.match(/[A-Z]/g) || []).length
    if (uppercaseCount / letters.length > 0.8) {
      reasons.push('spam_excessive_caps')
    }
  }

  // Excessive repeated characters (6+ of the same character in a row)
  if (/(.)\1{5,}/.test(text)) {
    reasons.push('spam_repeated_chars')
  }

  // Contains URLs/links
  if (URL_PATTERN.test(text)) {
    reasons.push('spam_contains_url')
  }

  // Contains email addresses (also a PII issue, caught separately)
  if (EMAIL_PATTERN.test(text)) {
    reasons.push('spam_contains_email')
  }

  // Just emoji/symbols with no real words (at least 2 word characters in sequence)
  const wordMatches = text.match(/[a-zA-Z]{2,}/g)
  if (!wordMatches || wordMatches.length < 1) {
    reasons.push('spam_no_real_words')
  }

  return reasons
}

// ── Minimum quality ───────────────────────────────────────────────────────────

function checkMinimumQuality(text: string): string[] {
  const reasons: string[] = []

  if (text.length < 10) {
    reasons.push('quality_too_short')
  }

  // Must contain at least 2 real words (sequences of 2+ letters)
  const words = text.match(/[a-zA-Z]{2,}/g)
  if (!words || words.length < 2) {
    reasons.push('quality_too_few_words')
  }

  return reasons
}

// ── PII detection ─────────────────────────────────────────────────────────────

const PHONE_PATTERN = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/

function checkPII(text: string): string[] {
  const reasons: string[] = []

  if (EMAIL_PATTERN.test(text)) {
    reasons.push('pii_email_detected')
  }

  if (PHONE_PATTERN.test(text)) {
    reasons.push('pii_phone_detected')
  }

  return reasons
}

// ── Main filter function ──────────────────────────────────────────────────────

/**
 * Filters review content for policy violations.
 *
 * Returns `passed: true` if the content is clean.
 * Returns `passed: false` with an array of reason codes if violations are found.
 *
 * Only filters the comment text. Rating-only reviews (no comment) always pass.
 */
export function filterReviewContent(comment: string): ContentFilterResult {
  const reasons: string[] = []

  // Run all checks
  reasons.push(...checkProfanity(comment))
  reasons.push(...checkSpam(comment))
  reasons.push(...checkMinimumQuality(comment))
  reasons.push(...checkPII(comment))

  // Deduplicate reasons
  const uniqueReasons = [...new Set(reasons)]

  return {
    passed: uniqueReasons.length === 0,
    reasons: uniqueReasons,
  }
}
