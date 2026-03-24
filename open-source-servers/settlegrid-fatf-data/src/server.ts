/**
 * settlegrid-fatf-data — FATF Country Assessments MCP Server
 *
 * Wraps World Bank regulatory quality indicators as FATF data proxy.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   list_countries()           — List countries (1\u00A2)
 *   get_assessment(country)    — Get assessment (2\u00A2)
 *   get_ratings(country)       — Get ratings (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CountryInput {
  country: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '50')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-fatf-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fatf-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_countries: { costCents: 1, displayName: 'List countries with AML data' },
      get_assessment: { costCents: 2, displayName: 'Get AML assessment for a country' },
      get_ratings: { costCents: 2, displayName: 'Get financial regulation ratings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listCountries = sg.wrap(async () => {
  return apiFetch<unknown>('/country', { per_page: '300' })
}, { method: 'list_countries' })

const getAssessment = sg.wrap(async (args: CountryInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  // RQ.EST = Regulatory Quality Estimate (proxy for AML compliance)
  return apiFetch<unknown>(`/country/${encodeURIComponent(args.country)}/indicator/RQ.EST`)
}, { method: 'get_assessment' })

const getRatings = sg.wrap(async (args: CountryInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  // RL.EST = Rule of Law Estimate
  return apiFetch<unknown>(`/country/${encodeURIComponent(args.country)}/indicator/RL.EST`)
}, { method: 'get_ratings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listCountries, getAssessment, getRatings }

console.log('settlegrid-fatf-data MCP server ready')
console.log('Methods: list_countries, get_assessment, get_ratings')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
