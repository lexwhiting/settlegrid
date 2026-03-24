/**
 * settlegrid-bls-statistics — Bureau of Labor Statistics MCP Server
 *
 * Wraps the BLS API v2 with SettleGrid billing.
 * Requires BLS_API_KEY (registration key in POST body).
 *
 * Methods:
 *   get_series(seriesId, startYear, endYear)  — Time series   (2¢)
 *   get_cpi(startYear, endYear)               — CPI-U data   (2¢)
 *   get_unemployment(startYear, endYear)      — Unemployment  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SeriesInput { seriesId: string; startYear: string; endYear: string }
interface YearRangeInput { startYear: string; endYear: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.bls.gov/publicAPI/v2'

function getKey(): string {
  const k = process.env.BLS_API_KEY
  if (!k) throw new Error('BLS_API_KEY environment variable is required')
  return k
}

async function blsFetch(seriesIds: string[], startYear: string, endYear: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/timeseries/data/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-bls-statistics/1.0 (contact@settlegrid.ai)',
    },
    body: JSON.stringify({
      seriesid: seriesIds,
      startyear: startYear,
      endyear: endYear,
      registrationkey: getKey(),
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`BLS API ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = await res.json() as { status: string; Results: { series: Array<Record<string, unknown>> } }
  if (json.status !== 'REQUEST_SUCCEEDED') {
    throw new Error(`BLS API error: ${json.status}`)
  }
  return json as Record<string, unknown>
}

function validateYear(year: string, name: string): string {
  if (!/^\d{4}$/.test(year)) throw new Error(`${name} must be a 4-digit year`)
  return year
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bls-statistics',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_series: { costCents: 2, displayName: 'Time Series' },
      get_cpi: { costCents: 2, displayName: 'CPI-U Data' },
      get_unemployment: { costCents: 2, displayName: 'Unemployment Rate' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSeries = sg.wrap(async (args: SeriesInput) => {
  if (!args.seriesId) throw new Error('seriesId is required (e.g. "CUUR0000SA0")')
  const start = validateYear(args.startYear, 'startYear')
  const end = validateYear(args.endYear, 'endYear')
  const data = await blsFetch([args.seriesId.trim()], start, end)
  return data
}, { method: 'get_series' })

const getCpi = sg.wrap(async (args: YearRangeInput) => {
  const start = validateYear(args.startYear, 'startYear')
  const end = validateYear(args.endYear, 'endYear')
  const data = await blsFetch(['CUUR0000SA0'], start, end)
  return data
}, { method: 'get_cpi' })

const getUnemployment = sg.wrap(async (args: YearRangeInput) => {
  const start = validateYear(args.startYear, 'startYear')
  const end = validateYear(args.endYear, 'endYear')
  const data = await blsFetch(['LNS14000000'], start, end)
  return data
}, { method: 'get_unemployment' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSeries, getCpi, getUnemployment }

console.log('settlegrid-bls-statistics MCP server ready')
console.log('Methods: get_series, get_cpi, get_unemployment')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
