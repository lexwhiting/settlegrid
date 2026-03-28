/**
 * settlegrid-hash-generator — Hash & Random Data Generator MCP Server
 *
 * Generates cryptographic hashes, UUIDs, and random strings. Useful for
 * agents building test data, verifying file integrity, generating unique
 * identifiers, or creating secure random tokens.
 *
 * Methods:
 *   generate_hash(text, algorithm?)  — hash text with MD5/SHA-1/SHA-256/SHA-512 (1 cent)
 *   generate_uuid(version?, count?)  — generate v4 UUIDs (1 cent)
 *   generate_random(length?, charset?) — generate random strings (1 cent)
 *   verify_hash(text, hash, algorithm?) — verify a hash matches text (1 cent)
 *
 * Pricing: 1 cent per call
 * Category: security
 *
 * Deploy: Vercel, Railway, or any Node.js host
 *   SETTLEGRID_TOOL_SLUG=hash-generator npx tsx hash-generator.ts
 */

import { settlegrid } from '@settlegrid/mcp'
import { createHash, randomBytes, randomUUID } from 'node:crypto'

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface HashInput {
  text: string
  algorithm?: string
  encoding?: 'hex' | 'base64'
}

interface VerifyInput {
  text: string
  hash: string
  algorithm?: string
}

interface UuidInput {
  count?: number
}

interface RandomInput {
  length?: number
  charset?: 'alphanumeric' | 'alpha' | 'numeric' | 'hex' | 'base64' | 'symbols'
  count?: number
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const VALID_ALGORITHMS = ['md5', 'sha1', 'sha256', 'sha512'] as const
const MAX_RANDOM_LENGTH = 1024
const MAX_COUNT = 50

const CHARSETS: Record<string, string> = {
  alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  numeric: '0123456789',
  hex: '0123456789abcdef',
  symbols: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}|;:,.<>?',
}

/* -------------------------------------------------------------------------- */
/*  SettleGrid init                                                           */
/* -------------------------------------------------------------------------- */

const sg = settlegrid.init({
  toolSlug: process.env.SETTLEGRID_TOOL_SLUG || 'hash-generator',
  pricing: {
    defaultCostCents: 1,
    methods: {
      generate_hash: { costCents: 1, displayName: 'Generate Hash' },
      generate_uuid: { costCents: 1, displayName: 'Generate UUID' },
      generate_random: { costCents: 1, displayName: 'Generate Random String' },
      verify_hash: { costCents: 1, displayName: 'Verify Hash' },
    },
  },
})

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function generateRandomString(length: number, charset: string): string {
  const bytes = randomBytes(length)
  const result: string[] = []
  for (let i = 0; i < length; i++) {
    result.push(charset[bytes[i] % charset.length])
  }
  return result.join('')
}

/* -------------------------------------------------------------------------- */
/*  Wrapped handlers                                                          */
/* -------------------------------------------------------------------------- */

const generateHash = sg.wrap(async (args: HashInput) => {
  if (!args.text || typeof args.text !== 'string') {
    throw new Error('text is required and must be a string')
  }

  const algo = (args.algorithm || 'sha256').toLowerCase()
  if (!VALID_ALGORITHMS.includes(algo as typeof VALID_ALGORITHMS[number])) {
    throw new Error(`Invalid algorithm "${algo}". Supported: ${VALID_ALGORITHMS.join(', ')}`)
  }

  const encoding = args.encoding === 'base64' ? 'base64' : 'hex'
  const hash = createHash(algo).update(args.text, 'utf8').digest(encoding)

  return {
    algorithm: algo,
    encoding,
    hash,
    input_length: args.text.length,
    hash_length: hash.length,
    input_bytes: Buffer.byteLength(args.text, 'utf8'),
  }
}, { method: 'generate_hash' })

const generateUuid = sg.wrap(async (args: UuidInput) => {
  const count = Math.min(Math.max(args.count ?? 1, 1), MAX_COUNT)
  const uuids: string[] = []

  for (let i = 0; i < count; i++) {
    uuids.push(randomUUID())
  }

  return {
    version: 4,
    count: uuids.length,
    uuids: count === 1 ? undefined : uuids,
    uuid: count === 1 ? uuids[0] : undefined,
  }
}, { method: 'generate_uuid' })

const generateRandom = sg.wrap(async (args: RandomInput) => {
  const length = Math.min(Math.max(args.length ?? 32, 1), MAX_RANDOM_LENGTH)
  const charsetName = args.charset ?? 'alphanumeric'
  const charset = CHARSETS[charsetName]
  if (!charset) {
    throw new Error(`Invalid charset "${charsetName}". Supported: ${Object.keys(CHARSETS).join(', ')}`)
  }

  const count = Math.min(Math.max(args.count ?? 1, 1), MAX_COUNT)
  const strings: string[] = []

  for (let i = 0; i < count; i++) {
    strings.push(generateRandomString(length, charset))
  }

  return {
    charset: charsetName,
    length,
    count: strings.length,
    strings: count === 1 ? undefined : strings,
    string: count === 1 ? strings[0] : undefined,
    entropy_bits: Math.round(Math.log2(charset.length) * length),
  }
}, { method: 'generate_random' })

const verifyHash = sg.wrap(async (args: VerifyInput) => {
  if (!args.text || typeof args.text !== 'string') {
    throw new Error('text is required and must be a string')
  }
  if (!args.hash || typeof args.hash !== 'string') {
    throw new Error('hash is required and must be a string')
  }

  const algo = (args.algorithm || 'sha256').toLowerCase()
  if (!VALID_ALGORITHMS.includes(algo as typeof VALID_ALGORITHMS[number])) {
    throw new Error(`Invalid algorithm "${algo}". Supported: ${VALID_ALGORITHMS.join(', ')}`)
  }

  const computedHex = createHash(algo).update(args.text, 'utf8').digest('hex')
  const computedBase64 = createHash(algo).update(args.text, 'utf8').digest('base64')
  const inputHash = args.hash.toLowerCase()

  const matchHex = computedHex === inputHash
  const matchBase64 = computedBase64 === args.hash

  return {
    algorithm: algo,
    match: matchHex || matchBase64,
    encoding_matched: matchHex ? 'hex' : matchBase64 ? 'base64' : 'none',
    computed_hex: computedHex,
    provided: args.hash,
  }
}, { method: 'verify_hash' })

/* -------------------------------------------------------------------------- */
/*  Exports                                                                   */
/* -------------------------------------------------------------------------- */

export { generateHash, generateUuid, generateRandom, verifyHash }

console.log('settlegrid-hash-generator MCP server ready')
console.log('Methods: generate_hash, generate_uuid, generate_random, verify_hash')
console.log('Pricing: 1 cent per call | Powered by SettleGrid')
