/**
 * settlegrid-password-gen — Password Generator MCP Server
 *
 * Generate cryptographically secure passwords and passphrases.
 *
 * Methods:
 *   generate(length, options)     — Generate a secure random password  (1¢)
 *   generate_passphrase(words)    — Generate a random word passphrase  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'
import { randomBytes, randomInt } from 'node:crypto'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GenerateInput {
  length?: number
  options?: string
}

interface GeneratePassphraseInput {
  words?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGITS = '0123456789'
const SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?'

const WORDLIST = [
  'apple','brave','cloud','dance','eagle','flame','globe','haven','ivory','jewel',
  'karma','lemon','mango','noble','ocean','pearl','quilt','river','stone','torch',
  'ultra','vivid','waltz','xenon','yield','zebra','amber','blaze','cedar','delta',
  'ember','frost','grace','haste','inlet','joker','knack','lunar','merit','north',
  'oasis','plume','quest','ridge','solar','tidal','unity','vigor','wheat','zonal',
]

function generatePassword(length: number, opts: string): string {
  let charset = LOWER + UPPER + DIGITS
  if (opts.includes('symbols') || opts.includes('special')) charset += SYMBOLS
  if (opts.includes('digits-only')) charset = DIGITS
  if (opts.includes('alpha-only')) charset = LOWER + UPPER
  const bytes = randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length]
  }
  return result
}

function assessStrength(pw: string): string {
  const len = pw.length
  const hasLower = /[a-z]/.test(pw)
  const hasUpper = /[A-Z]/.test(pw)
  const hasDigit = /\d/.test(pw)
  const hasSymbol = /[^a-zA-Z0-9]/.test(pw)
  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length
  if (len >= 20 && variety >= 3) return 'very-strong'
  if (len >= 16 && variety >= 3) return 'strong'
  if (len >= 12 && variety >= 2) return 'moderate'
  return 'weak'
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'password-gen',
  pricing: {
    defaultCostCents: 1,
    methods: {
      generate: { costCents: 1, displayName: 'Generate Password' },
      generate_passphrase: { costCents: 1, displayName: 'Generate Passphrase' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const generate = sg.wrap(async (args: GenerateInput) => {
  const length = Math.min(Math.max(typeof args.length === 'number' ? args.length : 16, 4), 128)
  const opts = typeof args.options === 'string' ? args.options.trim() : ''
  const password = generatePassword(length, opts)
  return { password, strength: assessStrength(password), length }
}, { method: 'generate' })

const generatePassphrase = sg.wrap(async (args: GeneratePassphraseInput) => {
  const count = Math.min(Math.max(typeof args.words === 'number' ? args.words : 4, 2), 12)
  const words: string[] = []
  for (let i = 0; i < count; i++) {
    words.push(WORDLIST[randomInt(WORDLIST.length)])
  }
  const passphrase = words.join('-')
  return { passphrase, wordCount: count }
}, { method: 'generate_passphrase' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { generate, generatePassphrase }

console.log('settlegrid-password-gen MCP server ready')
console.log('Methods: generate, generate_passphrase')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
