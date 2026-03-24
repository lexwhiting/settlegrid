/**
 * settlegrid-sec-xbrl — SEC XBRL Financial Data MCP Server
 *
 * Wraps the SEC XBRL API for structured financial data.
 * No API key needed. User-Agent required.
 *
 * Methods:
 *   get_company_concept(cik, taxonomy, tag)       — Single concept   (1¢)
 *   get_frames(taxonomy, tag, unit, period)       — Cross-company    (1¢)
 *   get_company_facts(cik)                        — All facts        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConceptInput { cik: string; taxonomy: string; tag: string }
interface FramesInput { taxonomy: string; tag: string; unit: string; period: string }
interface FactsInput { cik: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://data.sec.gov'
const UA = 'settlegrid-sec-xbrl/1.0 (contact@settlegrid.ai)'

async function secFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`SEC XBRL API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function padCik(cik: string): string {
  return cik.replace(/\D/g, '').padStart(10, '0')
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'sec-xbrl',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_company_concept: { costCents: 1, displayName: 'Company Concept' },
      get_frames: { costCents: 1, displayName: 'XBRL Frames' },
      get_company_facts: { costCents: 1, displayName: 'Company Facts' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCompanyConcept = sg.wrap(async (args: ConceptInput) => {
  if (!args.cik) throw new Error('cik is required')
  if (!args.taxonomy) throw new Error('taxonomy is required (e.g. "us-gaap")')
  if (!args.tag) throw new Error('tag is required (e.g. "Revenue")')
  const cik = padCik(args.cik)
  const data = await secFetch<Record<string, unknown>>(
    `/api/xbrl/companyconcept/CIK${cik}/${encodeURIComponent(args.taxonomy)}/${encodeURIComponent(args.tag)}.json`
  )
  return data
}, { method: 'get_company_concept' })

const getFrames = sg.wrap(async (args: FramesInput) => {
  if (!args.taxonomy) throw new Error('taxonomy is required (e.g. "us-gaap")')
  if (!args.tag) throw new Error('tag is required (e.g. "Revenue")')
  if (!args.unit) throw new Error('unit is required (e.g. "USD")')
  if (!args.period) throw new Error('period is required (e.g. "CY2023Q1I")')
  const data = await secFetch<Record<string, unknown>>(
    `/api/xbrl/frames/${encodeURIComponent(args.taxonomy)}/${encodeURIComponent(args.tag)}/${encodeURIComponent(args.unit)}/${encodeURIComponent(args.period)}.json`
  )
  return data
}, { method: 'get_frames' })

const getCompanyFacts = sg.wrap(async (args: FactsInput) => {
  if (!args.cik) throw new Error('cik is required')
  const cik = padCik(args.cik)
  const data = await secFetch<Record<string, unknown>>(`/api/xbrl/companyfacts/CIK${cik}.json`)
  return data
}, { method: 'get_company_facts' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCompanyConcept, getFrames, getCompanyFacts }

console.log('settlegrid-sec-xbrl MCP server ready')
console.log('Methods: get_company_concept, get_frames, get_company_facts')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
