/**
 * settlegrid-oecd-data — OECD Statistics MCP Server
 *
 * Wraps the OECD SDMX REST API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_dataset(dataflow, filter?)   — Fetch dataset      (1¢)
 *   get_dataflows()                  — List dataflows     (1¢)
 *   get_gdp(country)                — GDP data            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DatasetInput { dataflow: string; filter?: string }
interface GdpInput { country: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://sdmx.oecd.org/public/rest'
const UA = 'settlegrid-oecd-data/1.0 (contact@settlegrid.ai)'

async function oecdFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': UA, Accept: 'application/vnd.sdmx.data+json;version=1.0.0-wd' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OECD API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'oecd-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_dataset: { costCents: 1, displayName: 'Fetch Dataset' },
      get_dataflows: { costCents: 1, displayName: 'List Dataflows' },
      get_gdp: { costCents: 1, displayName: 'GDP Data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getDataset = sg.wrap(async (args: DatasetInput) => {
  if (!args.dataflow || typeof args.dataflow !== 'string') {
    throw new Error('dataflow is required (e.g. "QNA")')
  }
  const filter = args.filter ? `/${args.filter}` : '/all'
  const data = await oecdFetch<Record<string, unknown>>(
    `/data/OECD.SDD.NAD,DSD_NAMAIN1@DF_QNA_EXPENDITURE_CAPITA${filter}?startPeriod=2020&dimensionAtObservation=AllDimensions`
  )
  return data
}, { method: 'get_dataset' })

const getDataflows = sg.wrap(async () => {
  const res = await fetch(`${BASE}/dataflow/OECD`, {
    headers: { 'User-Agent': UA, Accept: 'application/vnd.sdmx.structure+json;version=1.0.0-wd' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OECD API ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json() as Record<string, unknown>
  return data
}, { method: 'get_dataflows' })

const getGdp = sg.wrap(async (args: GdpInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (3-letter ISO code, e.g. "USA")')
  }
  const country = args.country.toUpperCase().trim()
  const data = await oecdFetch<Record<string, unknown>>(
    `/data/OECD.SDD.NAD,DSD_NAMAIN1@DF_QNA_EXPENDITURE_CAPITA/${country}.B1_GE.VOBARSA.Q?startPeriod=2020&dimensionAtObservation=AllDimensions`
  )
  return { country, data }
}, { method: 'get_gdp' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getDataset, getDataflows, getGdp }

console.log('settlegrid-oecd-data MCP server ready')
console.log('Methods: get_dataset, get_dataflows, get_gdp')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
