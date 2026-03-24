/**
 * settlegrid-csv-tools — CSV Tools MCP Server
 *
 * Local computation — no external API needed.
 *
 * Methods:
 *   parse(csv)     — Parse CSV into structured data         (1¢)
 *   to_json(csv)   — Convert CSV to JSON array              (1¢)
 *   analyze(csv)   — Statistical analysis of CSV columns    (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CsvInput {
  csv: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MAX_SIZE = 500000

function parseCsvRows(csv: string): { headers: string[]; rows: string[][] } {
  if (!csv || typeof csv !== 'string') throw new Error('csv is required')
  if (csv.length > MAX_SIZE) throw new Error(`CSV too large (max ${MAX_SIZE} chars)`)

  const lines = csv.trim().split(/\r?\n/)
  if (lines.length < 2) throw new Error('CSV must have at least a header row and one data row')

  const delimiter = lines[0].includes('\t') ? '\t' : ','

  function splitLine(line: string): string[] {
    const fields: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (line[i] === delimiter && !inQuotes) {
        fields.push(current.trim())
        current = ''
      } else {
        current += line[i]
      }
    }
    fields.push(current.trim())
    return fields
  }

  const headers = splitLine(lines[0])
  const rows = lines.slice(1).filter((l) => l.trim()).map(splitLine)

  return { headers, rows }
}

function isNumeric(val: string): boolean {
  return val !== '' && !isNaN(Number(val))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'csv-tools',
  pricing: {
    defaultCostCents: 1,
    methods: {
      parse: { costCents: 1, displayName: 'Parse CSV' },
      to_json: { costCents: 1, displayName: 'CSV to JSON' },
      analyze: { costCents: 2, displayName: 'Analyze CSV' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const parse = sg.wrap(async (args: CsvInput) => {
  const { headers, rows } = parseCsvRows(args.csv)

  return {
    headers,
    rowCount: rows.length,
    columnCount: headers.length,
    preview: rows.slice(0, 10).map((row) => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = row[i] || '' })
      return obj
    }),
  }
}, { method: 'parse' })

const toJson = sg.wrap(async (args: CsvInput) => {
  const { headers, rows } = parseCsvRows(args.csv)

  const json = rows.slice(0, 1000).map((row) => {
    const obj: Record<string, string | number> = {}
    headers.forEach((h, i) => {
      const val = row[i] || ''
      obj[h] = isNumeric(val) ? Number(val) : val
    })
    return obj
  })

  return {
    count: json.length,
    truncated: rows.length > 1000,
    totalRows: rows.length,
    data: json,
  }
}, { method: 'to_json' })

const analyze = sg.wrap(async (args: CsvInput) => {
  const { headers, rows } = parseCsvRows(args.csv)

  const columns = headers.map((header, colIdx) => {
    const values = rows.map((r) => r[colIdx] || '')
    const nonEmpty = values.filter((v) => v !== '')
    const numeric = nonEmpty.filter(isNumeric).map(Number)

    const stats: Record<string, unknown> = {
      name: header,
      totalValues: values.length,
      nonEmpty: nonEmpty.length,
      empty: values.length - nonEmpty.length,
      uniqueValues: new Set(values).size,
      isNumeric: numeric.length > nonEmpty.length * 0.8,
    }

    if (numeric.length > 0) {
      const sorted = [...numeric].sort((a, b) => a - b)
      stats.min = sorted[0]
      stats.max = sorted[sorted.length - 1]
      stats.mean = Math.round((numeric.reduce((s, n) => s + n, 0) / numeric.length) * 100) / 100
      stats.median = sorted[Math.floor(sorted.length / 2)]
    } else {
      const topValues = nonEmpty.reduce((acc, v) => {
        acc[v] = (acc[v] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      stats.topValues = Object.entries(topValues)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => ({ value, count }))
    }

    return stats
  })

  return {
    rowCount: rows.length,
    columnCount: headers.length,
    columns,
  }
}, { method: 'analyze' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { parse, toJson, analyze }

console.log('settlegrid-csv-tools MCP server ready')
console.log('Methods: parse, to_json, analyze')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
