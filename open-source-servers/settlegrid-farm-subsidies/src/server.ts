/**
 * settlegrid-farm-subsidies — US Farm Subsidy Data MCP Server
 * Wraps USDA ERS data for farm subsidies with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface SubsidyRecord {
  state: string
  program: string
  year: number
  amount: number
  recipients: number | null
  avgPayment: number | null
}

interface FarmProgram {
  name: string
  code: string
  description: string
  category: string
}

interface ProgramStats {
  program: string
  totalPayments: number
  recipientCount: number
  avgPayment: number
  topStates: string[]
  yearRange: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const ERS_API = 'https://data.ers.usda.gov/api'

const PROGRAMS: FarmProgram[] = [
  { name: 'Agricultural Risk Coverage', code: 'ARC', description: 'Revenue-based county or individual coverage', category: 'Commodity' },
  { name: 'Price Loss Coverage', code: 'PLC', description: 'Price-based support payments', category: 'Commodity' },
  { name: 'Conservation Reserve Program', code: 'CRP', description: 'Land retirement for conservation', category: 'Conservation' },
  { name: 'EQIP', code: 'EQIP', description: 'Environmental Quality Incentives Program', category: 'Conservation' },
  { name: 'Crop Insurance', code: 'CI', description: 'Federal crop insurance subsidies', category: 'Insurance' },
  { name: 'Marketing Assistance Loans', code: 'MAL', description: 'Short-term commodity financing', category: 'Commodity' },
  { name: 'Dairy Margin Coverage', code: 'DMC', description: 'Dairy producer margin protection', category: 'Dairy' },
  { name: 'SNAP', code: 'SNAP', description: 'Supplemental Nutrition Assistance Program', category: 'Nutrition' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ERS API error: ${res.status} ${res.statusText} — ${body}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'farm-subsidies' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getSubsidies(state?: string, year?: number): Promise<{ records: SubsidyRecord[] }> {
  return sg.wrap('get_subsidies', async () => {
    const params = new URLSearchParams({ format: 'json' })
    if (state) params.set('state', state.trim().toUpperCase())
    if (year) {
      if (year < 1990 || year > 2100) throw new Error('Year must be between 1990 and 2100')
      params.set('year', String(year))
    }
    const data = await fetchJSON<{ data: SubsidyRecord[] }>(`${ERS_API}/farm-payments?${params}`)
    return { records: data.data || [] }
  })
}

async function listPrograms(): Promise<{ programs: FarmProgram[] }> {
  return sg.wrap('list_programs', async () => {
    return { programs: PROGRAMS }
  })
}

async function getStats(program: string): Promise<ProgramStats> {
  if (!program || !program.trim()) throw new Error('Program name is required')
  return sg.wrap('get_stats', async () => {
    const match = PROGRAMS.find(p =>
      p.name.toLowerCase().includes(program.toLowerCase()) ||
      p.code.toLowerCase() === program.toLowerCase()
    )
    if (!match) throw new Error(`Program not found: ${program}. Available: ${PROGRAMS.map(p => p.name).join(', ')}`)
    const params = new URLSearchParams({ program: match.code, format: 'json' })
    const data = await fetchJSON<{ data: { totalPayments: number; recipientCount: number; avgPayment: number; topStates: string[]; yearRange: string } }>(`${ERS_API}/farm-payments/summary?${params}`)
    return {
      program: match.name,
      totalPayments: data.data?.totalPayments || 0,
      recipientCount: data.data?.recipientCount || 0,
      avgPayment: data.data?.avgPayment || 0,
      topStates: data.data?.topStates || [],
      yearRange: data.data?.yearRange || '',
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getSubsidies, listPrograms, getStats }

console.log('settlegrid-farm-subsidies MCP server loaded')
