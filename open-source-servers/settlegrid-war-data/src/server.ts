/**
 * settlegrid-war-data — Conflict & War Data MCP Server
 * Wraps UCDP API with SettleGrid billing.
 * Methods:
 *   get_conflicts(country?, year?)  — Get conflicts (1¢)
 *   get_battle_deaths(conflict_id)  — Get battle deaths (2¢)
 *   list_countries()                — List countries (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConflictInput {
  country?: string
  year?: string
}

interface DeathsInput {
  conflict_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://ucdpapi.pcr.uu.se/api'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`)
  url.searchParams.set('pagesize', '20')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-war-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`UCDP API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'war-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_conflicts: { costCents: 1, displayName: 'Get armed conflicts' },
      get_battle_deaths: { costCents: 2, displayName: 'Get battle deaths' },
      list_countries: { costCents: 1, displayName: 'List countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getConflicts = sg.wrap(async (args: ConflictInput) => {
  const params: Record<string, string> = {}
  if (args.country) params.country = args.country
  if (args.year) params.year = args.year
  return apiFetch<unknown>('ucdpprioconflict/23.1', params)
}, { method: 'get_conflicts' })

const getBattleDeaths = sg.wrap(async (args: DeathsInput) => {
  if (!args.conflict_id || typeof args.conflict_id !== 'string') {
    throw new Error('conflict_id is required')
  }
  return apiFetch<unknown>(`battledeaths/23.1/${encodeURIComponent(args.conflict_id)}`)
}, { method: 'get_battle_deaths' })

const listCountries = sg.wrap(async () => {
  return apiFetch<unknown>('ucdpprioconflict/23.1', {
    pagesize: '50',
  })
}, { method: 'list_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getConflicts, getBattleDeaths, listCountries }

console.log('settlegrid-war-data MCP server ready')
console.log('Methods: get_conflicts, get_battle_deaths, list_countries')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
