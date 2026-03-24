/**
 * settlegrid-migration-data — Migration Statistics MCP Server
 * Wraps World Bank API with SettleGrid billing.
 * Methods:
 *   get_migration(country, year?)    — Get migration data (1¢)
 *   get_remittances(country, year?)  — Get remittances (2¢)
 *   list_indicators()                — List indicators (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface MigrationInput {
  country: string
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '50')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-migration-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`World Bank API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'migration-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_migration: { costCents: 1, displayName: 'Get migration data' },
      get_remittances: { costCents: 2, displayName: 'Get remittance data' },
      list_indicators: { costCents: 1, displayName: 'List indicators' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getMigration = sg.wrap(async (args: MigrationInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO2 code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(`country/${args.country.toUpperCase()}/indicator/SM.POP.NETM`, params)
}, { method: 'get_migration' })

const getRemittances = sg.wrap(async (args: MigrationInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(`country/${args.country.toUpperCase()}/indicator/BX.TRF.PWKR.CD.DT`, params)
}, { method: 'get_remittances' })

const listIndicators = sg.wrap(async () => {
  return {
    indicators: [
      { id: 'SM.POP.NETM', name: 'Net migration' },
      { id: 'SM.POP.TOTL', name: 'International migrant stock (total)' },
      { id: 'SM.POP.TOTL.ZS', name: 'International migrant stock (% of population)' },
      { id: 'SM.POP.REFG', name: 'Refugee population by country of asylum' },
      { id: 'SM.POP.REFG.OR', name: 'Refugee population by country of origin' },
      { id: 'BX.TRF.PWKR.CD.DT', name: 'Personal remittances received (current US$)' },
      { id: 'BX.TRF.PWKR.DT.GD.ZS', name: 'Personal remittances received (% of GDP)' },
      { id: 'BM.TRF.PWKR.CD.DT', name: 'Personal remittances paid (current US$)' },
    ],
  }
}, { method: 'list_indicators' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getMigration, getRemittances, listIndicators }

console.log('settlegrid-migration-data MCP server ready')
console.log('Methods: get_migration, get_remittances, list_indicators')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
