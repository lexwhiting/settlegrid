/**
 * settlegrid-eurostat — Eurostat EU Statistics MCP Server
 *
 * Wraps the Eurostat API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_dataset(datasetCode, filters?)  — Fetch dataset    (1¢)
 *   get_gdp(country?)                   — GDP data         (1¢)
 *   get_population(country?)            — Population data  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DatasetInput { datasetCode: string; filters?: string }
interface CountryInput { country?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0'
const UA = 'settlegrid-eurostat/1.0 (contact@settlegrid.ai)'

async function esFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Eurostat API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'eurostat',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_dataset: { costCents: 1, displayName: 'Fetch Dataset' },
      get_gdp: { costCents: 1, displayName: 'GDP Data' },
      get_population: { costCents: 1, displayName: 'Population Data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getDataset = sg.wrap(async (args: DatasetInput) => {
  if (!args.datasetCode || typeof args.datasetCode !== 'string') {
    throw new Error('datasetCode is required (e.g. "nama_10_gdp")')
  }
  const filters = args.filters ? `?${args.filters}` : ''
  const data = await esFetch<Record<string, unknown>>(`/data/${encodeURIComponent(args.datasetCode)}${filters}`)
  return data
}, { method: 'get_dataset' })

const getGdp = sg.wrap(async (args: CountryInput) => {
  const geo = args.country ? `&geo=${args.country.toUpperCase().trim()}` : ''
  const data = await esFetch<Record<string, unknown>>(`/data/nama_10_gdp?na_item=B1GQ&unit=CP_MEUR${geo}&lastTimePeriod=5`)
  return data
}, { method: 'get_gdp' })

const getPopulation = sg.wrap(async (args: CountryInput) => {
  const geo = args.country ? `&geo=${args.country.toUpperCase().trim()}` : ''
  const data = await esFetch<Record<string, unknown>>(`/data/demo_pjan?sex=T&age=TOTAL${geo}&lastTimePeriod=5`)
  return data
}, { method: 'get_population' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getDataset, getGdp, getPopulation }

console.log('settlegrid-eurostat MCP server ready')
console.log('Methods: get_dataset, get_gdp, get_population')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
