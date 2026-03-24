/**
 * settlegrid-json-tools — JSON Tools MCP Server
 *
 * Local computation — no external API needed.
 *
 * Methods:
 *   validate(json)    — Validate JSON string        (1¢)
 *   format(json)      — Pretty-print JSON           (1¢)
 *   diff(a, b)        — Compare two JSON objects     (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface JsonInput {
  json: string
}

interface DiffInput {
  a: string
  b: string
}

interface DiffEntry {
  path: string
  type: 'added' | 'removed' | 'changed'
  oldValue?: unknown
  newValue?: unknown
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MAX_SIZE = 100000

function safeParse(input: string, label: string): unknown {
  if (typeof input !== 'string') throw new Error(`${label} must be a string`)
  if (input.length > MAX_SIZE) throw new Error(`${label} too large (max ${MAX_SIZE} chars)`)
  try {
    return JSON.parse(input)
  } catch (e) {
    throw new Error(`Invalid JSON in ${label}: ${(e as Error).message}`)
  }
}

function deepDiff(a: unknown, b: unknown, path: string = ''): DiffEntry[] {
  const diffs: DiffEntry[] = []

  if (a === b) return diffs
  if (a === null || b === null || typeof a !== typeof b) {
    diffs.push({ path: path || '$', type: 'changed', oldValue: a, newValue: b })
    return diffs
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const maxLen = Math.max(a.length, b.length)
    for (let i = 0; i < maxLen && diffs.length < 100; i++) {
      const p = `${path}[${i}]`
      if (i >= a.length) diffs.push({ path: p, type: 'added', newValue: b[i] })
      else if (i >= b.length) diffs.push({ path: p, type: 'removed', oldValue: a[i] })
      else diffs.push(...deepDiff(a[i], b[i], p))
    }
    return diffs
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>
    const bObj = b as Record<string, unknown>
    const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)])
    for (const key of allKeys) {
      if (diffs.length >= 100) break
      const p = path ? `${path}.${key}` : key
      if (!(key in aObj)) diffs.push({ path: p, type: 'added', newValue: bObj[key] })
      else if (!(key in bObj)) diffs.push({ path: p, type: 'removed', oldValue: aObj[key] })
      else diffs.push(...deepDiff(aObj[key], bObj[key], p))
    }
    return diffs
  }
  if (a !== b) {
    diffs.push({ path: path || '$', type: 'changed', oldValue: a, newValue: b })
  }
  return diffs
}

function countNodes(obj: unknown): number {
  if (obj === null || typeof obj !== 'object') return 1
  if (Array.isArray(obj)) return 1 + obj.reduce((s, v) => s + countNodes(v), 0)
  return 1 + Object.values(obj as Record<string, unknown>).reduce((s, v) => s + countNodes(v), 0)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'json-tools',
  pricing: {
    defaultCostCents: 1,
    methods: {
      validate: { costCents: 1, displayName: 'Validate JSON' },
      format: { costCents: 1, displayName: 'Format JSON' },
      diff: { costCents: 2, displayName: 'Diff JSON' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const validate = sg.wrap(async (args: JsonInput) => {
  if (!args.json || typeof args.json !== 'string') throw new Error('json is required')
  try {
    const parsed = JSON.parse(args.json)
    return {
      valid: true,
      type: Array.isArray(parsed) ? 'array' : typeof parsed,
      nodes: countNodes(parsed),
      size: args.json.length,
    }
  } catch (e) {
    return {
      valid: false,
      error: (e as Error).message,
      size: args.json.length,
    }
  }
}, { method: 'validate' })

const format = sg.wrap(async (args: JsonInput) => {
  const parsed = safeParse(args.json, 'json')
  const formatted = JSON.stringify(parsed, null, 2)
  return {
    formatted,
    originalSize: args.json.length,
    formattedSize: formatted.length,
    type: Array.isArray(parsed) ? 'array' : typeof parsed,
  }
}, { method: 'format' })

const diff = sg.wrap(async (args: DiffInput) => {
  const objA = safeParse(args.a, 'a')
  const objB = safeParse(args.b, 'b')
  const diffs = deepDiff(objA, objB)

  return {
    identical: diffs.length === 0,
    changeCount: diffs.length,
    added: diffs.filter((d) => d.type === 'added').length,
    removed: diffs.filter((d) => d.type === 'removed').length,
    changed: diffs.filter((d) => d.type === 'changed').length,
    differences: diffs.slice(0, 50),
  }
}, { method: 'diff' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { validate, format, diff }

console.log('settlegrid-json-tools MCP server ready')
console.log('Methods: validate, format, diff')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
