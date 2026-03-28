/**
 * settlegrid-json-formatter — JSON Formatter & Validator MCP Server
 *
 * Takes messy JSON input and returns formatted, validated JSON with
 * structural analysis. Useful for agents processing web-scraped data,
 * cleaning API responses, or validating configuration files.
 *
 * Methods:
 *   format_json(input)        — validate, format, and analyze JSON (1 cent)
 *   minify_json(input)        — minify JSON to smallest representation (1 cent)
 *   extract_keys(input, depth?) — extract all keys with types (1 cent)
 *
 * Pricing: 1 cent per call
 * Category: utility
 *
 * Deploy: Vercel, Railway, or any Node.js host
 *   SETTLEGRID_TOOL_SLUG=json-formatter npx tsx json-formatter.ts
 */

import { settlegrid } from '@settlegrid/mcp'

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface FormatInput {
  input: string
  indent?: number
  sortKeys?: boolean
}

interface MinifyInput {
  input: string
}

interface ExtractKeysInput {
  input: string
  depth?: number
}

interface KeyInfo {
  path: string
  type: string
}

/* -------------------------------------------------------------------------- */
/*  SettleGrid init                                                           */
/* -------------------------------------------------------------------------- */

const sg = settlegrid.init({
  toolSlug: process.env.SETTLEGRID_TOOL_SLUG || 'json-formatter',
  pricing: {
    defaultCostCents: 1,
    methods: {
      format_json: { costCents: 1, displayName: 'Format JSON' },
      minify_json: { costCents: 1, displayName: 'Minify JSON' },
      extract_keys: { costCents: 1, displayName: 'Extract Keys' },
    },
  },
})

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function sortObjectKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys)
  }
  if (obj !== null && typeof obj === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key])
    }
    return sorted
  }
  return obj
}

function getJsonType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function extractKeysRecursive(
  obj: unknown,
  prefix: string,
  maxDepth: number,
  currentDepth: number,
  results: KeyInfo[]
): void {
  if (currentDepth > maxDepth) return
  if (obj === null || typeof obj !== 'object') return

  if (Array.isArray(obj)) {
    if (obj.length > 0) {
      extractKeysRecursive(obj[0], `${prefix}[]`, maxDepth, currentDepth + 1, results)
    }
    return
  }

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    results.push({ path, type: getJsonType(value) })
    extractKeysRecursive(value, path, maxDepth, currentDepth + 1, results)
  }
}

function countNodes(obj: unknown): number {
  if (obj === null || typeof obj !== 'object') return 1
  if (Array.isArray(obj)) {
    return 1 + obj.reduce((sum, item) => sum + countNodes(item), 0)
  }
  return 1 + Object.values(obj as Record<string, unknown>).reduce(
    (sum: number, val) => sum + countNodes(val),
    0
  )
}

/* -------------------------------------------------------------------------- */
/*  Wrapped handlers                                                          */
/* -------------------------------------------------------------------------- */

const formatJson = sg.wrap(async (args: FormatInput) => {
  if (!args.input || typeof args.input !== 'string') {
    throw new Error('input is required and must be a string')
  }

  const indent = Math.min(Math.max(args.indent ?? 2, 0), 8)

  try {
    let parsed = JSON.parse(args.input)
    if (args.sortKeys) {
      parsed = sortObjectKeys(parsed)
    }

    const formatted = JSON.stringify(parsed, null, indent)
    const rootType = getJsonType(parsed)
    const topLevelKeys = rootType === 'object' ? Object.keys(parsed) : undefined
    const arrayLength = rootType === 'array' ? (parsed as unknown[]).length : undefined
    const nodeCount = countNodes(parsed)
    const depth = JSON.stringify(parsed).split('').reduce((max, char, _, arr) => {
      // Approximate depth by tracking nesting
      return max
    }, 0)

    return {
      valid: true,
      formatted,
      root_type: rootType,
      top_level_keys: topLevelKeys,
      top_level_key_count: topLevelKeys?.length,
      array_length: arrayLength,
      node_count: nodeCount,
      original_bytes: Buffer.byteLength(args.input, 'utf8'),
      formatted_bytes: Buffer.byteLength(formatted, 'utf8'),
      keys_sorted: args.sortKeys ?? false,
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown parse error'
    const positionMatch = message.match(/position (\d+)/)
    return {
      valid: false,
      error: message,
      error_position: positionMatch ? parseInt(positionMatch[1], 10) : undefined,
      original_bytes: Buffer.byteLength(args.input, 'utf8'),
    }
  }
}, { method: 'format_json' })

const minifyJson = sg.wrap(async (args: MinifyInput) => {
  if (!args.input || typeof args.input !== 'string') {
    throw new Error('input is required and must be a string')
  }

  try {
    const parsed = JSON.parse(args.input)
    const minified = JSON.stringify(parsed)
    const originalBytes = Buffer.byteLength(args.input, 'utf8')
    const minifiedBytes = Buffer.byteLength(minified, 'utf8')
    const savingsPercent = originalBytes > 0
      ? Math.round((1 - minifiedBytes / originalBytes) * 100)
      : 0

    return {
      valid: true,
      minified,
      original_bytes: originalBytes,
      minified_bytes: minifiedBytes,
      savings_percent: savingsPercent,
      bytes_saved: originalBytes - minifiedBytes,
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown parse error'
    throw new Error(`Invalid JSON: ${message}`)
  }
}, { method: 'minify_json' })

const extractKeys = sg.wrap(async (args: ExtractKeysInput) => {
  if (!args.input || typeof args.input !== 'string') {
    throw new Error('input is required and must be a string')
  }

  const maxDepth = Math.min(Math.max(args.depth ?? 5, 1), 20)

  try {
    const parsed = JSON.parse(args.input)
    const keys: KeyInfo[] = []
    extractKeysRecursive(parsed, '', maxDepth, 0, keys)

    return {
      valid: true,
      root_type: getJsonType(parsed),
      keys,
      key_count: keys.length,
      max_depth_scanned: maxDepth,
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown parse error'
    throw new Error(`Invalid JSON: ${message}`)
  }
}, { method: 'extract_keys' })

/* -------------------------------------------------------------------------- */
/*  Exports                                                                   */
/* -------------------------------------------------------------------------- */

export { formatJson, minifyJson, extractKeys }

console.log('settlegrid-json-formatter MCP server ready')
console.log('Methods: format_json, minify_json, extract_keys')
console.log('Pricing: 1 cent per call | Powered by SettleGrid')
