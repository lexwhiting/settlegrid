/**
 * settlegrid-diff-tool — Text/Code Diff MCP Server
 *
 * Local computation — no external API needed.
 *
 * Methods:
 *   diff(original, modified)   — Generate line-by-line diff   (1¢)
 *   patch(original, diff)      — Apply a diff patch           (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DiffInput {
  original: string
  modified: string
}

interface PatchInput {
  original: string
  diff: string
}

interface DiffLine {
  type: 'add' | 'remove' | 'equal'
  lineNumber: number
  content: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MAX_SIZE = 200000

function validateString(val: unknown, name: string): string {
  if (typeof val !== 'string') throw new Error(`${name} is required`)
  if (val.length > MAX_SIZE) throw new Error(`${name} too large (max ${MAX_SIZE} chars)`)
  return val
}

function computeLCS(a: string[], b: string[]): boolean[][] {
  const m = a.length
  const n = b.length
  // Use space-efficient LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // Backtrack to find which lines are in LCS
  const inLCS: boolean[][] = [
    Array(m).fill(false),
    Array(n).fill(false),
  ]
  let i = m, j = n
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      inLCS[0][i - 1] = true
      inLCS[1][j - 1] = true
      i--; j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }
  return inLCS
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'diff-tool',
  pricing: {
    defaultCostCents: 1,
    methods: {
      diff: { costCents: 1, displayName: 'Text Diff' },
      patch: { costCents: 1, displayName: 'Apply Patch' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const diff = sg.wrap(async (args: DiffInput) => {
  const original = validateString(args.original, 'original')
  const modified = validateString(args.modified, 'modified')

  const origLines = original.split('\n')
  const modLines = modified.split('\n')

  // Cap at 2000 lines for performance
  if (origLines.length > 2000 || modLines.length > 2000) {
    throw new Error('Files too large for diff (max 2000 lines each)')
  }

  const inLCS = computeLCS(origLines, modLines)
  const lines: DiffLine[] = []
  let oi = 0, mi = 0, lineNum = 1

  while (oi < origLines.length || mi < modLines.length) {
    if (oi < origLines.length && inLCS[0][oi]) {
      if (mi < modLines.length && inLCS[1][mi]) {
        lines.push({ type: 'equal', lineNumber: lineNum, content: origLines[oi] })
        oi++; mi++; lineNum++
      } else if (mi < modLines.length) {
        lines.push({ type: 'add', lineNumber: lineNum, content: modLines[mi] })
        mi++; lineNum++
      }
    } else if (oi < origLines.length) {
      lines.push({ type: 'remove', lineNumber: lineNum, content: origLines[oi] })
      oi++; lineNum++
    } else if (mi < modLines.length) {
      lines.push({ type: 'add', lineNumber: lineNum, content: modLines[mi] })
      mi++; lineNum++
    }
  }

  const added = lines.filter((l) => l.type === 'add').length
  const removed = lines.filter((l) => l.type === 'remove').length
  const unchanged = lines.filter((l) => l.type === 'equal').length

  return {
    summary: {
      added,
      removed,
      unchanged,
      totalLines: lines.length,
    },
    identical: added === 0 && removed === 0,
    lines: lines.slice(0, 500),
  }
}, { method: 'diff' })

const patch = sg.wrap(async (args: PatchInput) => {
  const original = validateString(args.original, 'original')
  const diffJson = validateString(args.diff, 'diff')

  let parsed: { lines: DiffLine[] }
  try {
    parsed = JSON.parse(diffJson)
  } catch {
    throw new Error('diff must be valid JSON from the diff method output')
  }

  if (!Array.isArray(parsed.lines)) throw new Error('diff must contain a "lines" array')

  const result: string[] = []
  for (const line of parsed.lines) {
    if (line.type === 'equal' || line.type === 'add') {
      result.push(line.content)
    }
    // 'remove' lines are skipped
  }

  return {
    result: result.join('\n'),
    linesApplied: parsed.lines.length,
    originalLines: original.split('\n').length,
    resultLines: result.length,
  }
}, { method: 'patch' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { diff, patch }

console.log('settlegrid-diff-tool MCP server ready')
console.log('Methods: diff, patch')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
