/**
 * settlegrid-south-korea — Korea Open Data MCP Server
 *
 * South Korean government statistics and open data.
 *
 * Methods:
 *   search_statistics(keyword)    — Search Korean statistical tables  (1¢)
 *   get_table(table_id)           — Get data from a specific statistical table  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchStatisticsInput {
  keyword: string
}

interface GetTableInput {
  table_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://kosis.kr/openapi'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-south-korea/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Korea Open Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'south-korea',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_statistics: { costCents: 1, displayName: 'Search Statistics' },
      get_table: { costCents: 1, displayName: 'Get Table' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchStatistics = sg.wrap(async (args: SearchStatisticsInput) => {
  if (!args.keyword || typeof args.keyword !== 'string') throw new Error('keyword is required')
  const keyword = args.keyword.trim()
  const data = await apiFetch<any>(`/Param/statisticsParameterData.json?method=getList&searchWord=${encodeURIComponent(keyword)}&format=json`)
  const items = (data.result ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        TBL_NM: item.TBL_NM,
        TBL_ID: item.TBL_ID,
        ORG_NM: item.ORG_NM,
        PRD_DE: item.PRD_DE,
    })),
  }
}, { method: 'search_statistics' })

const getTable = sg.wrap(async (args: GetTableInput) => {
  if (!args.table_id || typeof args.table_id !== 'string') throw new Error('table_id is required')
  const table_id = args.table_id.trim()
  const data = await apiFetch<any>(`/Param/statisticsParameterData.json?method=getStatsData&orgId=101&tblId=${encodeURIComponent(table_id)}&format=json`)
  return {
    result: data.result,
  }
}, { method: 'get_table' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchStatistics, getTable }

console.log('settlegrid-south-korea MCP server ready')
console.log('Methods: search_statistics, get_table')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
