/**
 * settlegrid-dns-lookup — DNS Lookup MCP Server
 *
 * Wraps Google DNS-over-HTTPS with SettleGrid billing.
 * No API key needed — Google DoH is free.
 *
 * Methods:
 *   resolve(domain, type?) — DNS resolution (1¢)
 *   get_records(domain) — All record types (2¢)
 *   check_dnssec(domain) — DNSSEC validation (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ResolveInput { domain: string; type?: string }
interface RecordsInput { domain: string }
interface DnssecInput { domain: string }

interface DnsAnswer {
  name: string
  type: number
  TTL: number
  data: string
}

interface DnsResponse {
  Status: number
  TC: boolean
  RD: boolean
  RA: boolean
  AD: boolean
  CD: boolean
  Answer?: DnsAnswer[]
  Question: { name: string; type: number }[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://dns.google/resolve'
const RECORD_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA', 'CAA', 'PTR']

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function validateDomain(domain: string): string {
  const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!d.includes('.')) throw new Error('Invalid domain format')
  return d
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'dns-lookup',
  pricing: {
    defaultCostCents: 1,
    methods: {
      resolve: { costCents: 1, displayName: 'DNS Resolve' },
      get_records: { costCents: 2, displayName: 'All Records' },
      check_dnssec: { costCents: 1, displayName: 'DNSSEC Check' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const resolve = sg.wrap(async (args: ResolveInput) => {
  if (!args.domain) throw new Error('domain is required')
  const domain = validateDomain(args.domain)
  const type = (args.type || 'A').toUpperCase()
  if (!RECORD_TYPES.includes(type)) throw new Error(`Invalid type. Use: ${RECORD_TYPES.join(', ')}`)
  const data = await apiFetch<DnsResponse>(`?name=${domain}&type=${type}`)
  return {
    domain,
    type,
    status: data.Status === 0 ? 'NOERROR' : `ERROR(${data.Status})`,
    answers: data.Answer || [],
    dnssec_validated: data.AD,
  }
}, { method: 'resolve' })

const getRecords = sg.wrap(async (args: RecordsInput) => {
  if (!args.domain) throw new Error('domain is required')
  const domain = validateDomain(args.domain)
  const types = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'SOA', 'CAA']
  const results: Record<string, DnsAnswer[]> = {}
  await Promise.all(types.map(async (type) => {
    try {
      const data = await apiFetch<DnsResponse>(`?name=${domain}&type=${type}`)
      if (data.Answer?.length) results[type] = data.Answer
    } catch { /* skip failed types */ }
  }))
  return {
    domain,
    records: results,
    types_found: Object.keys(results),
  }
}, { method: 'get_records' })

const checkDnssec = sg.wrap(async (args: DnssecInput) => {
  if (!args.domain) throw new Error('domain is required')
  const domain = validateDomain(args.domain)
  const [aData, dnskeyData] = await Promise.all([
    apiFetch<DnsResponse>(`?name=${domain}&type=A&do=1`),
    apiFetch<DnsResponse>(`?name=${domain}&type=DNSKEY&do=1`).catch(() => null),
  ])
  return {
    domain,
    dnssec_validated: aData.AD,
    has_dnskey: !!(dnskeyData?.Answer?.length),
    status: aData.AD ? 'SECURE' : 'INSECURE',
    checking_disabled: aData.CD,
  }
}, { method: 'check_dnssec' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { resolve, getRecords, checkDnssec }

console.log('settlegrid-dns-lookup MCP server ready')
console.log('Methods: resolve, get_records, check_dnssec')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
