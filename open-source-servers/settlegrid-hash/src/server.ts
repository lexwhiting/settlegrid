/**
 * settlegrid-hash — Hash Generator MCP Server
 *
 * Hash text with SHA-256, SHA-512, MD5, and more.
 *
 * Methods:
 *   hash_text(text, algorithm)    — Hash text with a specified algorithm  (1¢)
 *   hash_compare(text, hash, algorithm) — Check if text matches a hash  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'
import { createHash } from 'node:crypto'

// ─── Types ──────────────────────────────────────────────────────────────────

interface HashTextInput {
  text: string
  algorithm?: string
}

interface HashCompareInput {
  text: string
  hash: string
  algorithm?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const VALID_ALGORITHMS = ['sha256', 'sha512', 'sha1', 'md5', 'sha384', 'sha224']

function computeHash(text: string, algo: string): string {
  const alg = VALID_ALGORITHMS.includes(algo) ? algo : 'sha256'
  return createHash(alg).update(text, 'utf8').digest('hex')
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'hash',
  pricing: {
    defaultCostCents: 1,
    methods: {
      hash_text: { costCents: 1, displayName: 'Hash Text' },
      hash_compare: { costCents: 1, displayName: 'Compare Hash' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const hashText = sg.wrap(async (args: HashTextInput) => {
  if (!args.text || typeof args.text !== 'string') throw new Error('text is required')
  const algo = typeof args.algorithm === 'string' ? args.algorithm.trim().toLowerCase() : 'sha256'
  const hash = computeHash(args.text, algo)
  return { hash, algorithm: VALID_ALGORITHMS.includes(algo) ? algo : 'sha256' }
}, { method: 'hash_text' })

const hashCompare = sg.wrap(async (args: HashCompareInput) => {
  if (!args.text || typeof args.text !== 'string') throw new Error('text is required')
  if (!args.hash || typeof args.hash !== 'string') throw new Error('hash is required')
  const algo = typeof args.algorithm === 'string' ? args.algorithm.trim().toLowerCase() : 'sha256'
  const computed = computeHash(args.text, algo)
  return { match: computed === args.hash.trim().toLowerCase(), algorithm: VALID_ALGORITHMS.includes(algo) ? algo : 'sha256' }
}, { method: 'hash_compare' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { hashText, hashCompare }

console.log('settlegrid-hash MCP server ready')
console.log('Methods: hash_text, hash_compare')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
