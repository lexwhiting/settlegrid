/**
 * settlegrid-password-gen — Password Generator MCP Server
 *
 * Generates secure passwords locally with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   generate_password(length?, uppercase?, numbers?, symbols?) — password (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'
import { randomBytes } from 'node:crypto'

interface PwInput { length?: number; uppercase?: boolean; numbers?: boolean; symbols?: boolean }

const sg = settlegrid.init({
  toolSlug: 'password-gen',
  pricing: { defaultCostCents: 1, methods: { generate_password: { costCents: 1, displayName: 'Generate Password' } } },
})

const generatePassword = sg.wrap(async (args: PwInput) => {
  const len = Math.min(Math.max(args.length ?? 16, 8), 128)
  let chars = 'abcdefghijklmnopqrstuvwxyz'
  if (args.uppercase !== false) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (args.numbers !== false) chars += '0123456789'
  if (args.symbols !== false) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?'
  const bytes = randomBytes(len)
  let password = ''
  for (let i = 0; i < len; i++) password += chars[bytes[i] % chars.length]
  const strength = len >= 20 && args.symbols !== false ? 'strong' : len >= 12 ? 'good' : 'fair'
  return { password, length: len, strength, charset_size: chars.length, entropy_bits: Math.round(Math.log2(chars.length) * len) }
}, { method: 'generate_password' })

export { generatePassword }

console.log('settlegrid-password-gen MCP server ready')
console.log('Methods: generate_password')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
