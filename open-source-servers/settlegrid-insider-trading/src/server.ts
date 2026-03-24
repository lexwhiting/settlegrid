/**
 * settlegrid-insider-trading — SEC Insider Trading MCP Server
 * Wraps SEC EDGAR EFTS API with SettleGrid billing.
 *
 * Track SEC Form 4 insider trading filings. Monitor corporate
 * insider buys and sells from officers, directors, and 10% owners.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Filing {
  id: string
  entity_name: string
  file_num: string
  file_date: string
  period_of_report: string
  form_type: string
  file_url: string
}

interface SearchResponse {
  hits: { _source: Filing }[]
  total: { value: number; relation: string }
}

interface FilingResult {
  filings: Filing[]
  total: number
  query: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://efts.sec.gov/LATEST'
const MAX_RESULTS = 50
const DEFAULT_LIMIT = 10
const HEADERS: Record<string, string> = {
  'User-Agent': 'SettleGrid/1.0 (support@settlegrid.ai)',
  Accept: 'application/json',
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function validateLimit(limit: number | undefined, defaultVal: number): number {
  const l = limit ?? defaultVal
  if (l < 1) throw new Error('Limit must be at least 1')
  return Math.min(l, MAX_RESULTS)
}

function validateSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase()
  if (!s || s.length > 10) throw new Error(`Invalid stock symbol: ${symbol}`)
  return s
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`SEC EDGAR error: ${res.status} ${res.statusText} ${body}`)
  }
  return res.json() as Promise<T>
}

function extractFilings(data: SearchResponse): Filing[] {
  return (data.hits || []).map(h => h._source)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'insider-trading' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getFilings(symbol: string, limit?: number): Promise<FilingResult> {
  const sym = validateSymbol(symbol)
  const l = validateLimit(limit, DEFAULT_LIMIT)
  return sg.wrap('get_filings', async () => {
    const data = await fetchJSON<SearchResponse>(
      `${API}/search-index?q="${encodeURIComponent(sym)}"&forms=4&dateRange=custom&startdt=2020-01-01&enddt=2026-12-31&from=0&size=${l}`
    )
    return { filings: extractFilings(data), total: data.total?.value || 0, query: sym }
  })
}

async function getRecent(limit?: number): Promise<FilingResult> {
  const l = validateLimit(limit, 20)
  return sg.wrap('get_recent', async () => {
    const data = await fetchJSON<SearchResponse>(
      `${API}/search-index?forms=4&dateRange=custom&startdt=2025-01-01&enddt=2026-12-31&from=0&size=${l}`
    )
    return { filings: extractFilings(data), total: data.total?.value || 0, query: 'recent' }
  })
}

async function searchInsiders(name: string): Promise<FilingResult> {
  if (!name || name.trim().length < 2) throw new Error('Insider name is required (at least 2 characters)')
  const cleanName = name.trim()
  return sg.wrap('search_insiders', async () => {
    const data = await fetchJSON<SearchResponse>(
      `${API}/search-index?q="${encodeURIComponent(cleanName)}"&forms=4&from=0&size=20`
    )
    return { filings: extractFilings(data), total: data.total?.value || 0, query: cleanName }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getFilings, getRecent, searchInsiders }
export type { Filing, FilingResult }
console.log('settlegrid-insider-trading server started')
