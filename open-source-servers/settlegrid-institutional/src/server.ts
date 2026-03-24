/**
 * settlegrid-institutional — 13F Institutional Holdings MCP Server
 * Wraps SEC EDGAR API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Filing {
  accessionNumber: string
  filingDate: string
  reportDate: string
  form: string
  primaryDocument: string
  primaryDocDescription: string
}

interface InstitutionResult {
  entity_name: string
  cik: string
  file_num: string
  form_type: string
  file_date: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const EDGAR = 'https://data.sec.gov'
const EFTS = 'https://efts.sec.gov/LATEST'
const HEADERS = { 'User-Agent': 'SettleGrid/1.0 (support@settlegrid.ai)', Accept: 'application/json' }

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`SEC API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

function padCik(cik: string): string {
  return cik.replace(/^0+/, '').padStart(10, '0')
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'institutional' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getHoldings(cik: string, limit?: number): Promise<Filing[]> {
  if (!cik) throw new Error('CIK number is required')
  return sg.wrap('get_holdings', async () => {
    const paddedCik = padCik(cik)
    const data = await fetchJSON<any>(`${EDGAR}/submissions/CIK${paddedCik}.json`)
    const filings = data.filings?.recent || {}
    const results: Filing[] = []
    const l = Math.min(limit || 5, 20)
    for (let i = 0; i < (filings.form?.length || 0) && results.length < l; i++) {
      if (filings.form[i] === '13F-HR') {
        results.push({
          accessionNumber: filings.accessionNumber[i],
          filingDate: filings.filingDate[i],
          reportDate: filings.reportDate?.[i] || '',
          form: filings.form[i],
          primaryDocument: filings.primaryDocument?.[i] || '',
          primaryDocDescription: filings.primaryDocDescription?.[i] || '',
        })
      }
    }
    return results
  })
}

async function searchInstitutions(query: string): Promise<InstitutionResult[]> {
  if (!query) throw new Error('Search query is required')
  return sg.wrap('search_institutions', async () => {
    const data = await fetchJSON<any>(`${EFTS}/search-index?q="${encodeURIComponent(query)}"&forms=13F-HR&from=0&size=20`)
    return (data.hits || []).map((h: any) => h._source)
  })
}

async function getFiling(accession: string): Promise<any> {
  if (!accession) throw new Error('Accession number is required')
  return sg.wrap('get_filing', async () => {
    const clean = accession.replace(/-/g, '')
    const data = await fetchJSON<any>(`${EDGAR}/Archives/edgar/data/${clean}.json`)
    return data
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getHoldings, searchInstitutions, getFiling }
console.log('settlegrid-institutional server started')
