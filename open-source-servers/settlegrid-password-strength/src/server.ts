/**
 * settlegrid-password-strength — Password Strength Checker MCP Server
 *
 * Password Strength Checker tools with SettleGrid billing.
 * Pricing: 1-2c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

interface CheckInput { password: string }
interface GenerateInput { length?: number; uppercase?: boolean; lowercase?: boolean; numbers?: boolean; symbols?: boolean }

const COMMON_PASSWORDS = new Set(['password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', 'master', 'dragon', 'login', 'letmein', 'princess', 'admin', 'welcome', 'shadow', 'sunshine', 'trustno1', 'iloveyou', 'batman', 'football', 'charlie'])

const sg = settlegrid.init({ toolSlug: 'password-strength', pricing: { defaultCostCents: 1, methods: {
  check_strength: { costCents: 1, displayName: 'Check Password Strength' },
  generate: { costCents: 1, displayName: 'Generate Password' },
}}})

const checkStrength = sg.wrap(async (args: CheckInput) => {
  if (!args.password) throw new Error('password required')
  const p = args.password
  let score = 0
  const checks = {
    length_8: p.length >= 8, length_12: p.length >= 12, length_16: p.length >= 16,
    uppercase: /[A-Z]/.test(p), lowercase: /[a-z]/.test(p),
    numbers: /[0-9]/.test(p), symbols: /[^A-Za-z0-9]/.test(p),
    no_common: !COMMON_PASSWORDS.has(p.toLowerCase()),
    no_sequential: !/(.){2,}/.test(p) && !/012|123|234|345|456|567|678|789/.test(p),
  }
  if (checks.length_8) score += 1; if (checks.length_12) score += 1; if (checks.length_16) score += 1
  if (checks.uppercase) score += 1; if (checks.lowercase) score += 1
  if (checks.numbers) score += 1; if (checks.symbols) score += 1
  if (checks.no_common) score += 1; if (checks.no_sequential) score += 1
  const entropy = Math.round(p.length * Math.log2((checks.lowercase ? 26 : 0) + (checks.uppercase ? 26 : 0) + (checks.numbers ? 10 : 0) + (checks.symbols ? 32 : 0) || 1))
  const rating = score <= 3 ? 'weak' : score <= 5 ? 'fair' : score <= 7 ? 'strong' : 'very strong'
  return { length: p.length, score, max_score: 9, rating, entropy_bits: entropy, checks, suggestions: !checks.length_12 ? ['Use at least 12 characters'] : !checks.symbols ? ['Add special characters'] : [] }
}, { method: 'check_strength' })

const generate = sg.wrap(async (args: GenerateInput) => {
  const len = Math.min(Math.max(args.length ?? 16, 8), 128)
  let chars = ''
  if (args.lowercase !== false) chars += 'abcdefghijklmnopqrstuvwxyz'
  if (args.uppercase !== false) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (args.numbers !== false) chars += '0123456789'
  if (args.symbols !== false) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?'
  if (!chars) chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const password = Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return { password, length: len, character_set_size: chars.length, entropy_bits: Math.round(len * Math.log2(chars.length)) }
}, { method: 'generate' })

export { checkStrength, generate }
console.log('settlegrid-password-strength MCP server ready | Powered by SettleGrid')
