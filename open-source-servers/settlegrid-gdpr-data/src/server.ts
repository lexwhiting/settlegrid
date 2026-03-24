/**
 * settlegrid-gdpr-data — GDPR Compliance Info MCP Server
 * Wraps GDPR enforcement data with SettleGrid billing.
 *
 * Search GDPR enforcement actions, fines, and statistics
 * across EU/EEA member states for compliance monitoring.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface GDPRFine {
  id: string
  country: string
  authority: string
  date: string
  fine_amount: number
  currency: string
  controller: string
  sector: string
  article_violated: string[]
  type: string
  summary: string
}

interface GDPRSearchResult {
  query: string
  total: number
  results: GDPRFine[]
}

interface GDPRStats {
  country: string | null
  total_fines: number
  total_amount: number
  currency: string
  average_fine: number
  largest_fine: GDPRFine | null
  by_article: Record<string, number>
  by_sector: Record<string, number>
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const ENFORCEMENT_DATA: GDPRFine[] = [
  { id: 'GDPR-001', country: 'LU', authority: 'CNPD', date: '2021-07-16', fine_amount: 746000000, currency: 'EUR', controller: 'Amazon Europe Core S.a.r.l.', sector: 'Technology', article_violated: ['Art. 5', 'Art. 6'], type: 'fine', summary: 'Non-compliance with general data processing principles' },
  { id: 'GDPR-002', country: 'IE', authority: 'DPC', date: '2023-05-22', fine_amount: 1200000000, currency: 'EUR', controller: 'Meta Platforms Ireland Ltd.', sector: 'Technology', article_violated: ['Art. 46'], type: 'fine', summary: 'Insufficient legal basis for data transfers to the US' },
  { id: 'GDPR-003', country: 'FR', authority: 'CNIL', date: '2022-01-06', fine_amount: 150000000, currency: 'EUR', controller: 'Google LLC', sector: 'Technology', article_violated: ['Art. 82'], type: 'fine', summary: 'Cookies consent mechanism violations' },
  { id: 'GDPR-004', country: 'IE', authority: 'DPC', date: '2022-09-05', fine_amount: 405000000, currency: 'EUR', controller: 'Instagram (Meta)', sector: 'Technology', article_violated: ['Art. 5', 'Art. 6', 'Art. 12-13'], type: 'fine', summary: 'Children\'s data processing violations' },
  { id: 'GDPR-005', country: 'IT', authority: 'Garante', date: '2020-01-17', fine_amount: 27800000, currency: 'EUR', controller: 'TIM S.p.A.', sector: 'Telecom', article_violated: ['Art. 5', 'Art. 6', 'Art. 17', 'Art. 21'], type: 'fine', summary: 'Aggressive telemarketing practices' },
  { id: 'GDPR-006', country: 'DE', authority: 'BfDI', date: '2019-11-05', fine_amount: 14500000, currency: 'EUR', controller: 'Deutsche Wohnen SE', sector: 'Real Estate', article_violated: ['Art. 5', 'Art. 25'], type: 'fine', summary: 'Excessive data retention of tenant records' },
  { id: 'GDPR-007', country: 'SE', authority: 'IMY', date: '2023-06-14', fine_amount: 58000000, currency: 'SEK', controller: 'Spotify AB', sector: 'Technology', article_violated: ['Art. 15'], type: 'fine', summary: 'Failure to properly fulfill DSAR requests' },
  { id: 'GDPR-008', country: 'ES', authority: 'AEPD', date: '2021-03-11', fine_amount: 8150000, currency: 'EUR', controller: 'CaixaBank', sector: 'Finance', article_violated: ['Art. 6', 'Art. 7'], type: 'fine', summary: 'Processing customer data without valid consent' },
]

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(100, limit))
}

function validateCountryCode(code: string): string {
  const upper = code.trim().toUpperCase()
  if (upper.length !== 2) throw new Error(`Invalid country code: ${code}. Must be 2 letters (ISO).`)
  return upper
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'gdpr-data',
  pricing: { defaultCostCents: 2, methods: { search_fines: 2, get_fine: 2, get_stats: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchFines = sg.wrap(async (args: { query?: string; country?: string; limit?: number }) => {
  const lim = clampLimit(args.limit)
  let results = [...ENFORCEMENT_DATA]
  if (args.country) {
    const cc = validateCountryCode(args.country)
    results = results.filter(f => f.country === cc)
  }
  if (args.query?.trim()) {
    const q = args.query.trim().toLowerCase()
    results = results.filter(f =>
      f.controller.toLowerCase().includes(q) ||
      f.summary.toLowerCase().includes(q) ||
      f.sector.toLowerCase().includes(q) ||
      f.article_violated.some(a => a.toLowerCase().includes(q))
    )
  }
  return { query: args.query || '', total: results.length, results: results.slice(0, lim) } as GDPRSearchResult
}, { method: 'search_fines' })

const getFine = sg.wrap(async (args: { id: string }) => {
  if (!args.id?.trim()) throw new Error('Fine ID is required')
  const fine = ENFORCEMENT_DATA.find(f => f.id === args.id.trim())
  if (!fine) throw new Error(`Fine not found: ${args.id}`)
  return fine
}, { method: 'get_fine' })

const getStats = sg.wrap(async (args: { country?: string }) => {
  let data = [...ENFORCEMENT_DATA]
  const cc = args.country ? validateCountryCode(args.country) : null
  if (cc) data = data.filter(f => f.country === cc)
  const totalAmount = data.reduce((sum, f) => sum + f.fine_amount, 0)
  const byArticle: Record<string, number> = {}
  const bySector: Record<string, number> = {}
  data.forEach(f => {
    f.article_violated.forEach(a => { byArticle[a] = (byArticle[a] || 0) + 1 })
    bySector[f.sector] = (bySector[f.sector] || 0) + 1
  })
  const largest = data.sort((a, b) => b.fine_amount - a.fine_amount)[0] || null
  return {
    country: cc,
    total_fines: data.length,
    total_amount: totalAmount,
    currency: 'EUR',
    average_fine: data.length > 0 ? Math.round(totalAmount / data.length) : 0,
    largest_fine: largest,
    by_article: byArticle,
    by_sector: bySector,
  } as GDPRStats
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchFines, getFine, getStats, ENFORCEMENT_DATA }
export type { GDPRFine, GDPRSearchResult, GDPRStats }
console.log('settlegrid-gdpr-data MCP server ready')
