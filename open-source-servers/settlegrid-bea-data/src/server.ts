/**
 * settlegrid-bea-data — Bureau of Economic Analysis MCP Server
 *
 * Wraps the BEA API with SettleGrid billing.
 * Requires BEA_API_KEY environment variable.
 *
 * Methods:
 *   get_gdp(year)                       — GDP data           (2¢)
 *   get_datasets()                      — List datasets      (1¢)
 *   get_regional_income(year, state?)   — Regional income    (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GdpInput { year: string }
interface RegionalInput { year: string; state?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://apps.bea.gov/api/data'

function getKey(): string {
  const k = process.env.BEA_API_KEY
  if (!k) throw new Error('BEA_API_KEY environment variable is required')
  return k
}

async function beaFetch<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(BASE)
  url.searchParams.set('UserID', getKey())
  url.searchParams.set('ResultFormat', 'JSON')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-bea-data/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`BEA API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bea-data',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_gdp: { costCents: 2, displayName: 'GDP Data' },
      get_datasets: { costCents: 1, displayName: 'List Datasets' },
      get_regional_income: { costCents: 2, displayName: 'Regional Income' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getGdp = sg.wrap(async (args: GdpInput) => {
  if (!args.year || !/^\d{4}$/.test(args.year)) {
    throw new Error('year is required (e.g. "2023")')
  }
  const data = await beaFetch<Record<string, unknown>>({
    method: 'GetData',
    DatasetName: 'NIPA',
    TableName: 'T10101',
    Frequency: 'A',
    Year: args.year,
  })
  return data
}, { method: 'get_gdp' })

const getDatasets = sg.wrap(async () => {
  const data = await beaFetch<Record<string, unknown>>({ method: 'GETDATASETLIST' })
  return data
}, { method: 'get_datasets' })

const getRegionalIncome = sg.wrap(async (args: RegionalInput) => {
  if (!args.year || !/^\d{4}$/.test(args.year)) {
    throw new Error('year is required (e.g. "2023")')
  }
  const params: Record<string, string> = {
    method: 'GetData',
    DatasetName: 'Regional',
    TableName: 'CAINC1',
    LineCode: '1',
    Year: args.year,
    GeoFips: args.state ?? 'STATE',
  }
  const data = await beaFetch<Record<string, unknown>>(params)
  return data
}, { method: 'get_regional_income' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getGdp, getDatasets, getRegionalIncome }

console.log('settlegrid-bea-data MCP server ready')
console.log('Methods: get_gdp, get_datasets, get_regional_income')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
