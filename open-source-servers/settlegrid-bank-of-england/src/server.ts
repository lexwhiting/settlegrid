/**
 * settlegrid-bank-of-england — Bank of England Statistics MCP Server
 *
 * Wraps the BoE Statistical Interactive Database with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_series(seriesCode, fromDate?)  — Time series data   (1¢)
 *   get_bank_rate()                    — Bank rate history  (1¢)
 *   get_inflation()                    — CPI inflation      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SeriesInput { seriesCode: string; fromDate?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.bankofengland.co.uk/boeapps/database'
const UA = 'settlegrid-bank-of-england/1.0 (contact@settlegrid.ai)'

async function boeFetch(seriesCodes: string, fromDate?: string): Promise<string> {
  const url = new URL(`${BASE}/fromshowcolumns.asp`)
  url.searchParams.set('SeriesCodes', seriesCodes)
  url.searchParams.set('CSVF', 'TN')
  url.searchParams.set('UsingCodes', 'Y')
  url.searchParams.set('VPD', 'Y')
  if (fromDate) url.searchParams.set('FromDate', fromDate)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': UA },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`BoE API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.text()
}

function parseCsv(csv: string): Array<Record<string, string>> {
  const lines = csv.trim().split('\n').filter((l) => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''))
  return lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim().replace(/"/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  })
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bank-of-england',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_series: { costCents: 1, displayName: 'Time Series' },
      get_bank_rate: { costCents: 1, displayName: 'Bank Rate' },
      get_inflation: { costCents: 1, displayName: 'CPI Inflation' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSeries = sg.wrap(async (args: SeriesInput) => {
  if (!args.seriesCode || typeof args.seriesCode !== 'string') {
    throw new Error('seriesCode is required (e.g. "IUDBEDR")')
  }
  const csv = await boeFetch(args.seriesCode.trim(), args.fromDate)
  const rows = parseCsv(csv)
  return { seriesCode: args.seriesCode, count: rows.length, data: rows.slice(0, 50) }
}, { method: 'get_series' })

const getBankRate = sg.wrap(async () => {
  const csv = await boeFetch('IUDBEDR', '01/Jan/2020')
  const rows = parseCsv(csv)
  return { series: 'IUDBEDR', description: 'Official Bank Rate', count: rows.length, data: rows }
}, { method: 'get_bank_rate' })

const getInflation = sg.wrap(async () => {
  const csv = await boeFetch('D7BT', '01/Jan/2020')
  const rows = parseCsv(csv)
  return { series: 'D7BT', description: 'CPI Annual Rate', count: rows.length, data: rows }
}, { method: 'get_inflation' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSeries, getBankRate, getInflation }

console.log('settlegrid-bank-of-england MCP server ready')
console.log('Methods: get_series, get_bank_rate, get_inflation')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
