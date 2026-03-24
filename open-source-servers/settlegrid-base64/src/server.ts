/**
 * settlegrid-base64 — Base64 MCP Server
 *
 * Encode and decode Base64 strings.
 *
 * Methods:
 *   encode(text)                  — Encode text to Base64  (1¢)
 *   decode(encoded)               — Decode Base64 to text  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface EncodeInput {
  text: string
}

interface DecodeInput {
  encoded: string
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'base64',
  pricing: {
    defaultCostCents: 1,
    methods: {
      encode: { costCents: 1, displayName: 'Encode' },
      decode: { costCents: 1, displayName: 'Decode' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const encode = sg.wrap(async (args: EncodeInput) => {
  if (!args.text || typeof args.text !== 'string') throw new Error('text is required')
  const encoded = Buffer.from(args.text, 'utf8').toString('base64')
  return { encoded, length: encoded.length }
}, { method: 'encode' })

const decode = sg.wrap(async (args: DecodeInput) => {
  if (!args.encoded || typeof args.encoded !== 'string') throw new Error('encoded is required')
  const decoded = Buffer.from(args.encoded.trim(), 'base64').toString('utf8')
  return { decoded, length: decoded.length }
}, { method: 'decode' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { encode, decode }

console.log('settlegrid-base64 MCP server ready')
console.log('Methods: encode, decode')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
