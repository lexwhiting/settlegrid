/**
 * settlegrid-regex-tester — Regex Testing MCP Server
 *
 * Local computation — no external API needed.
 *
 * Methods:
 *   test(pattern, text)       — Test a regex against text         (1¢)
 *   explain(pattern)          — Explain what a regex does         (1¢)
 *   generate(description)     — Generate regex from description   (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TestInput {
  pattern: string
  text: string
}

interface ExplainInput {
  pattern: string
}

interface GenerateInput {
  description: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const PATTERN_DESCRIPTIONS: Record<string, string> = {
  '\\d': 'digit (0-9)',
  '\\w': 'word character (letter, digit, underscore)',
  '\\s': 'whitespace',
  '\\b': 'word boundary',
  '.': 'any character',
  '*': 'zero or more of previous',
  '+': 'one or more of previous',
  '?': 'zero or one of previous',
  '^': 'start of string',
  '$': 'end of string',
  '\\D': 'non-digit',
  '\\W': 'non-word character',
  '\\S': 'non-whitespace',
}

const COMMON_PATTERNS: Record<string, string> = {
  email: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
  url: '^https?:\\/\\/[\\w.-]+(?:\\.[a-zA-Z]{2,})(?:\\/[^\\s]*)?$',
  phone: '^\\+?\\d{1,4}[-.\\s]?\\(?\\d{1,3}\\)?[-.\\s]?\\d{3,4}[-.\\s]?\\d{3,4}$',
  ip: '^(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$',
  date: '^\\d{4}[-/](?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\\d|3[01])$',
  hex: '^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$',
  uuid: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  slug: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  zipcode: '^\\d{5}(?:-\\d{4})?$',
  creditcard: '^(?:4\\d{12}(?:\\d{3})?|5[1-5]\\d{14}|3[47]\\d{13})$',
  ssn: '^\\d{3}-\\d{2}-\\d{4}$',
  time: '^(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?$',
  username: '^[a-zA-Z0-9_]{3,20}$',
  password: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$',
  mac: '^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$',
}

function safeRegex(pattern: string, flags?: string): RegExp {
  if (pattern.length > 500) throw new Error('Pattern too long (max 500 chars)')
  try {
    return new RegExp(pattern, flags)
  } catch (e) {
    throw new Error(`Invalid regex: ${(e as Error).message}`)
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'regex-tester',
  pricing: {
    defaultCostCents: 1,
    methods: {
      test: { costCents: 1, displayName: 'Test Regex' },
      explain: { costCents: 1, displayName: 'Explain Regex' },
      generate: { costCents: 2, displayName: 'Generate Regex' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const test = sg.wrap(async (args: TestInput) => {
  if (!args.pattern || typeof args.pattern !== 'string') throw new Error('pattern is required')
  if (typeof args.text !== 'string') throw new Error('text is required')
  if (args.text.length > 10000) throw new Error('text too long (max 10,000 chars)')

  const regex = safeRegex(args.pattern, 'g')
  const matches: Array<{ match: string; index: number; groups?: Record<string, string> }> = []
  let m: RegExpExecArray | null

  let iterations = 0
  while ((m = regex.exec(args.text)) !== null && iterations < 100) {
    matches.push({
      match: m[0],
      index: m.index,
      groups: m.groups ? { ...m.groups } : undefined,
    })
    if (m[0].length === 0) regex.lastIndex++
    iterations++
  }

  return {
    pattern: args.pattern,
    text: args.text.slice(0, 200),
    matches: matches.length > 0,
    matchCount: matches.length,
    results: matches.slice(0, 50),
  }
}, { method: 'test' })

const explain = sg.wrap(async (args: ExplainInput) => {
  if (!args.pattern || typeof args.pattern !== 'string') throw new Error('pattern is required')
  safeRegex(args.pattern) // Validate

  const tokens: Array<{ token: string; description: string }> = []
  let i = 0
  while (i < args.pattern.length) {
    if (args.pattern[i] === '\\' && i + 1 < args.pattern.length) {
      const escaped = args.pattern.slice(i, i + 2)
      tokens.push({ token: escaped, description: PATTERN_DESCRIPTIONS[escaped] || `literal ${args.pattern[i + 1]}` })
      i += 2
    } else if (PATTERN_DESCRIPTIONS[args.pattern[i]]) {
      tokens.push({ token: args.pattern[i], description: PATTERN_DESCRIPTIONS[args.pattern[i]] })
      i++
    } else if (args.pattern[i] === '[') {
      const end = args.pattern.indexOf(']', i)
      const charClass = end > i ? args.pattern.slice(i, end + 1) : args.pattern[i]
      tokens.push({ token: charClass, description: `character class: one of ${charClass}` })
      i = end > i ? end + 1 : i + 1
    } else if (args.pattern[i] === '(') {
      tokens.push({ token: '(', description: 'start of group' })
      i++
    } else if (args.pattern[i] === ')') {
      tokens.push({ token: ')', description: 'end of group' })
      i++
    } else if (args.pattern[i] === '{') {
      const end = args.pattern.indexOf('}', i)
      const quantifier = end > i ? args.pattern.slice(i, end + 1) : args.pattern[i]
      tokens.push({ token: quantifier, description: `repeat ${quantifier} times` })
      i = end > i ? end + 1 : i + 1
    } else if (args.pattern[i] === '|') {
      tokens.push({ token: '|', description: 'OR (alternative)' })
      i++
    } else {
      tokens.push({ token: args.pattern[i], description: `literal "${args.pattern[i]}"` })
      i++
    }
  }

  return { pattern: args.pattern, tokens }
}, { method: 'explain' })

const generate = sg.wrap(async (args: GenerateInput) => {
  if (!args.description || typeof args.description !== 'string') throw new Error('description is required')

  const desc = args.description.toLowerCase()
  const matched: Array<{ name: string; pattern: string }> = []

  for (const [name, pattern] of Object.entries(COMMON_PATTERNS)) {
    if (desc.includes(name) || desc.includes(name.replace(/([A-Z])/g, ' $1').toLowerCase())) {
      matched.push({ name, pattern })
    }
  }

  // Keyword heuristics
  if (matched.length === 0) {
    if (desc.includes('number') || desc.includes('digit')) matched.push({ name: 'numbers', pattern: '\\d+' })
    if (desc.includes('word')) matched.push({ name: 'words', pattern: '\\w+' })
    if (desc.includes('letter')) matched.push({ name: 'letters', pattern: '[a-zA-Z]+' })
    if (desc.includes('space') || desc.includes('whitespace')) matched.push({ name: 'whitespace', pattern: '\\s+' })
  }

  return {
    description: args.description,
    suggestions: matched.length > 0 ? matched : [{ name: 'no match', pattern: 'No common pattern found for this description' }],
    allPatterns: Object.keys(COMMON_PATTERNS),
  }
}, { method: 'generate' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { test, explain, generate }

console.log('settlegrid-regex-tester MCP server ready')
console.log('Methods: test, explain, generate')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
