/**
 * settlegrid-un-data — UN Statistics MCP Server
 *
 * United Nations statistical data (population, GDP, trade).
 *
 * Methods:
 *   get_indicator(dataflow, key)  — Get UN statistical data by dataflow and key  (1¢)
 *   list_dataflows()              — List available UN data sources (dataflows)  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetIndicatorInput {
  dataflow: string
  key: string
}

interface ListDataflowsInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://data.un.org/ws/rest'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-un-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`UN Statistics API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'un-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_indicator: { costCents: 1, displayName: 'Get Indicator' },
      list_dataflows: { costCents: 1, displayName: 'List Dataflows' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIndicator = sg.wrap(async (args: GetIndicatorInput) => {
  if (!args.dataflow || typeof args.dataflow !== 'string') throw new Error('dataflow is required')
  const dataflow = args.dataflow.trim()
  if (!args.key || typeof args.key !== 'string') throw new Error('key is required')
  const key = args.key.trim()
  const data = await apiFetch<any>(`/data/${encodeURIComponent(dataflow)}/${encodeURIComponent(key)}?format=jsondata&detail=dataonly&lastNObservations=5`)
  return {
    dataSets: data.dataSets,
    structure: data.structure,
  }
}, { method: 'get_indicator' })

const listDataflows = sg.wrap(async (args: ListDataflowsInput) => {

  const data = await apiFetch<any>(`/dataflow/all?format=jsondata`)
  const items = (data.dataflows ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        agencyID: item.agencyID,
    })),
  }
}, { method: 'list_dataflows' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIndicator, listDataflows }

console.log('settlegrid-un-data MCP server ready')
console.log('Methods: get_indicator, list_dataflows')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
