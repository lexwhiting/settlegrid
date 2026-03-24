/**
 * settlegrid-base64-tools — Base64 Tools MCP Server
 *
 * Encode/decode Base64 locally with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   base64_encode(text) — encode to Base64 (1¢)
 *   base64_decode(encoded) — decode from Base64 (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface EncodeInput { text: string }
interface DecodeInput { encoded: string }

const sg = settlegrid.init({
  toolSlug: 'base64-tools',
  pricing: {
    defaultCostCents: 1,
    methods: {
      base64_encode: { costCents: 1, displayName: 'Base64 Encode' },
      base64_decode: { costCents: 1, displayName: 'Base64 Decode' },
    },
  },
})

const base64Encode = sg.wrap(async (args: EncodeInput) => {
  if (!args.text && args.text !== '') throw new Error('text is required')
  const encoded = Buffer.from(args.text, 'utf-8').toString('base64')
  return { original_length: args.text.length, encoded, encoded_length: encoded.length }
}, { method: 'base64_encode' })

const base64Decode = sg.wrap(async (args: DecodeInput) => {
  if (!args.encoded) throw new Error('encoded string is required')
  try {
    const decoded = Buffer.from(args.encoded, 'base64').toString('utf-8')
    return { encoded_length: args.encoded.length, decoded, decoded_length: decoded.length }
  } catch {
    throw new Error('Invalid Base64 input')
  }
}, { method: 'base64_decode' })

export { base64Encode, base64Decode }

console.log('settlegrid-base64-tools MCP server ready')
console.log('Methods: base64_encode, base64_decode')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
