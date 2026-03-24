/**
 * settlegrid-japan-estat — Japan e-Stat MCP Server
 *
 * Japanese government statistics from the e-Stat portal.
 *
 * Methods:
 *   search_statistics(keyword, lang) — Search Japanese statistical surveys and tables  (2¢)
 *   get_stats_data(stats_data_id) — Get statistical data for a specific table ID  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchStatisticsInput {
  keyword: string
  lang?: string
}

interface GetStatsDataInput {
  stats_data_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.e-stat.go.jp/rest/3.0/app'
const API_KEY = process.env.ESTAT_APP_ID ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-japan-estat/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Japan e-Stat API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'japan-estat',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_statistics: { costCents: 2, displayName: 'Search Statistics' },
      get_stats_data: { costCents: 2, displayName: 'Get Stats Data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchStatistics = sg.wrap(async (args: SearchStatisticsInput) => {
  if (!args.keyword || typeof args.keyword !== 'string') throw new Error('keyword is required')
  const keyword = args.keyword.trim()
  const lang = typeof args.lang === 'string' ? args.lang.trim() : ''
  const data = await apiFetch<any>(`/json/getStatsList?searchWord=${encodeURIComponent(keyword)}&lang=${encodeURIComponent(lang)}&limit=10&appId=${API_KEY}`)
  const items = (data.GET_STATS_LIST.DATALIST_INF.TABLE_INF ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        @id: item.@id,
        STAT_NAME: item.STAT_NAME,
        TITLE: item.TITLE,
        SURVEY_DATE: item.SURVEY_DATE,
    })),
  }
}, { method: 'search_statistics' })

const getStatsData = sg.wrap(async (args: GetStatsDataInput) => {
  if (!args.stats_data_id || typeof args.stats_data_id !== 'string') throw new Error('stats_data_id is required')
  const stats_data_id = args.stats_data_id.trim()
  const data = await apiFetch<any>(`/json/getStatsData?statsDataId=${encodeURIComponent(stats_data_id)}&limit=20&appId=${API_KEY}`)
  return {
    GET_STATS_DATA: data.GET_STATS_DATA,
  }
}, { method: 'get_stats_data' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchStatistics, getStatsData }

console.log('settlegrid-japan-estat MCP server ready')
console.log('Methods: search_statistics, get_stats_data')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
