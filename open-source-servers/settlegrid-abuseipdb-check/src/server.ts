/**
 * settlegrid-abuseipdb-check — AbuseIPDB Check MCP Server
 *
 * Wraps AbuseIPDB API with SettleGrid billing.
 * Free key from https://www.abuseipdb.com/account/api.
 *
 * Methods:
 *   check_ip_abuse(ip) — check IP (2¢)
 *   get_blacklist(confidence_min?) — blacklist (3¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface CheckInput { ip: string }
interface BlacklistInput { confidence_min?: number }

const API_BASE = 'https://api.abuseipdb.com/api/v2'
const API_KEY = process.env.ABUSEIPDB_API_KEY || ''

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    headers: { 'Key': API_KEY, 'Accept': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'abuseipdb-check',
  pricing: {
    defaultCostCents: 2,
    methods: {
      check_ip_abuse: { costCents: 2, displayName: 'Check IP' },
      get_blacklist: { costCents: 3, displayName: 'Blacklist' },
    },
  },
})

const checkIpAbuse = sg.wrap(async (args: CheckInput) => {
  if (!args.ip) throw new Error('ip is required')
  if (!API_KEY) throw new Error('ABUSEIPDB_API_KEY not set')
  const data = await apiFetch<any>(`/check?ipAddress=${args.ip}&maxAgeInDays=90&verbose`)
  const d = data.data
  return {
    ip: d.ipAddress, is_public: d.isPublic, abuse_confidence: d.abuseConfidenceScore,
    country: d.countryCode, isp: d.isp, domain: d.domain, usage_type: d.usageType,
    total_reports: d.totalReports, distinct_users: d.numDistinctUsers,
    last_reported: d.lastReportedAt, is_whitelisted: d.isWhitelisted,
  }
}, { method: 'check_ip_abuse' })

const getBlacklist = sg.wrap(async (args: BlacklistInput) => {
  if (!API_KEY) throw new Error('ABUSEIPDB_API_KEY not set')
  const min = args.confidence_min ?? 90
  const data = await apiFetch<any>(`/blacklist?confidenceMinimum=${min}&limit=50`)
  return {
    generated_at: data.meta?.generatedAt,
    entries: (data.data || []).map((d: any) => ({
      ip: d.ipAddress, abuse_confidence: d.abuseConfidenceScore,
      country: d.countryCode, last_reported: d.lastReportedAt,
    })),
  }
}, { method: 'get_blacklist' })

export { checkIpAbuse, getBlacklist }

console.log('settlegrid-abuseipdb-check MCP server ready')
console.log('Methods: check_ip_abuse, get_blacklist')
console.log('Pricing: 2-3¢ per call | Powered by SettleGrid')
