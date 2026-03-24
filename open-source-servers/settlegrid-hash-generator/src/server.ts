/**
 * settlegrid-hash-generator — Hash Generator MCP Server
 *
 * Generates cryptographic hashes locally with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   generate_hash(text, algorithm?) — generate hash (1¢)
 *   compare_hash(text, hash, algorithm?) — verify hash (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'
import { createHash } from 'node:crypto'

interface HashInput { text: string; algorithm?: string }
interface CompareInput { text: string; hash: string; algorithm?: string }

const VALID_ALGORITHMS = ['md5', 'sha1', 'sha256', 'sha512']

const sg = settlegrid.init({
  toolSlug: 'hash-generator',
  pricing: {
    defaultCostCents: 1,
    methods: {
      generate_hash: { costCents: 1, displayName: 'Generate Hash' },
      compare_hash: { costCents: 1, displayName: 'Compare Hash' },
    },
  },
})

const generateHash = sg.wrap(async (args: HashInput) => {
  if (!args.text) throw new Error('text is required')
  const algo = (args.algorithm || 'sha256').toLowerCase()
  if (!VALID_ALGORITHMS.includes(algo)) throw new Error(`Invalid algorithm. Use: ${VALID_ALGORITHMS.join(', ')}`)
  const hash = createHash(algo).update(args.text).digest('hex')
  return { algorithm: algo, hash, input_length: args.text.length, hash_length: hash.length }
}, { method: 'generate_hash' })

const compareHash = sg.wrap(async (args: CompareInput) => {
  if (!args.text || !args.hash) throw new Error('text and hash are required')
  const algo = (args.algorithm || 'sha256').toLowerCase()
  if (!VALID_ALGORITHMS.includes(algo)) throw new Error(`Invalid algorithm. Use: ${VALID_ALGORITHMS.join(', ')}`)
  const computed = createHash(algo).update(args.text).digest('hex')
  return { algorithm: algo, match: computed === args.hash.toLowerCase(), computed, expected: args.hash }
}, { method: 'compare_hash' })

export { generateHash, compareHash }

console.log('settlegrid-hash-generator MCP server ready')
console.log('Methods: generate_hash, compare_hash')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
