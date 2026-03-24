/**
 * settlegrid-world-bank-education — World Bank Education Data MCP Server
 *
 * Wraps the World Bank API (education indicators) with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_enrollment(country, level?, year?)  — Get enrollment data (2\u00A2)
 *   get_literacy(country, year?)            — Get literacy rates (2\u00A2)
 *   list_indicators()                       — List education indicators (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface EnrollmentInput {
  country: string
  level?: string
  year?: string
}

interface LiteracyInput {
  country: string
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'

const ENROLLMENT_INDICATORS: Record<string, string> = {
  primary: 'SE.PRM.ENRR',
  secondary: 'SE.SEC.ENRR',
  tertiary: 'SE.TER.ENRR',
}

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '100')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-world-bank-education/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`World Bank API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'world-bank-education',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_enrollment: { costCents: 2, displayName: 'Get school enrollment data' },
      get_literacy: { costCents: 2, displayName: 'Get literacy rate data' },
      list_indicators: { costCents: 1, displayName: 'List education indicators' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getEnrollment = sg.wrap(async (args: EnrollmentInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const level = args.level?.toLowerCase() || 'primary'
  const indicator = ENROLLMENT_INDICATORS[level]
  if (!indicator) {
    throw new Error(`Invalid level: ${level}. Use: primary, secondary, tertiary`)
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(`/country/${encodeURIComponent(args.country)}/indicator/${indicator}`, params)
}, { method: 'get_enrollment' })

const getLiteracy = sg.wrap(async (args: LiteracyInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(`/country/${encodeURIComponent(args.country)}/indicator/SE.ADT.LITR.ZS`, params)
}, { method: 'get_literacy' })

const listIndicators = sg.wrap(async () => {
  return {
    indicators: [
      { code: 'SE.PRM.ENRR', name: 'Primary school enrollment rate' },
      { code: 'SE.SEC.ENRR', name: 'Secondary school enrollment rate' },
      { code: 'SE.TER.ENRR', name: 'Tertiary school enrollment rate' },
      { code: 'SE.ADT.LITR.ZS', name: 'Adult literacy rate' },
      { code: 'SE.XPD.TOTL.GD.ZS', name: 'Education expenditure (% GDP)' },
      { code: 'SE.PRM.CMPT.ZS', name: 'Primary completion rate' },
    ],
  }
}, { method: 'list_indicators' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getEnrollment, getLiteracy, listIndicators }

console.log('settlegrid-world-bank-education MCP server ready')
console.log('Methods: get_enrollment, get_literacy, list_indicators')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
