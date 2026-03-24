/**
 * Batch 3F2 — Servers 206-220 (15 servers)
 * Infrastructure & Telecom MCP servers.
 */
import { gen } from './core.mjs'

console.log('\n=== Batch 3F2: Servers 206-220 (15 Infrastructure/Telecom servers) ===\n')

// ─── 206: Internet Speed ────────────────────────────────────────────────────
gen({
  slug: 'internet-speed',
  title: 'Internet Speed Data',
  desc: 'Global internet speed statistics and rankings from M-Lab speed test data.',
  api: { base: 'https://speed.measurementlab.net', name: 'M-Lab Speed Test', docs: 'https://www.measurementlab.net/data/' },
  key: null,
  keywords: ['internet', 'speed', 'bandwidth', 'network', 'mlab'],
  methods: [
    { name: 'get_stats', display: 'Get internet speed statistics by country', cost: 1, params: 'country?', inputs: [
      { name: 'country', type: 'string', required: false, desc: 'ISO country code (e.g. US, GB)' },
    ]},
    { name: 'get_rankings', display: 'Get global internet speed rankings', cost: 1, params: 'limit?', inputs: [
      { name: 'limit', type: 'number', required: false, desc: 'Number of results (default 20)' },
    ]},
    { name: 'get_history', display: 'Get historical speed data for a country', cost: 2, params: 'country?, months?', inputs: [
      { name: 'country', type: 'string', required: false, desc: 'ISO country code' },
      { name: 'months', type: 'number', required: false, desc: 'Number of months of history (default 12)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-internet-speed — Internet Speed Data MCP Server
 *
 * Wraps M-Lab speed test data with SettleGrid billing.
 * No API key needed — M-Lab data is public.
 *
 * Methods:
 *   get_stats(country?) — Speed statistics (1¢)
 *   get_rankings(limit?) — Global rankings (1¢)
 *   get_history(country?, months?) — Historical data (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface StatsInput { country?: string }
interface RankingsInput { limit?: number }
interface HistoryInput { country?: string; months?: number }

interface SpeedStats {
  country: string
  download_mbps: number
  upload_mbps: number
  latency_ms: number
  tests: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://speed.measurementlab.net'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'internet-speed',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_stats: { costCents: 1, displayName: 'Speed Statistics' },
      get_rankings: { costCents: 1, displayName: 'Speed Rankings' },
      get_history: { costCents: 2, displayName: 'Speed History' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getStats = sg.wrap(async (args: StatsInput) => {
  const country = args.country?.toUpperCase() || 'US'
  if (country.length !== 2) throw new Error('country must be a 2-letter ISO code')
  const data = await apiFetch<any>(\`/api/v0/stats?country=\${country}\`)
  return {
    country,
    stats: data,
    source: 'M-Lab NDT speed tests',
  }
}, { method: 'get_stats' })

const getRankings = sg.wrap(async (args: RankingsInput) => {
  const limit = args.limit ?? 20
  if (limit < 1 || limit > 100) throw new Error('limit must be 1-100')
  const data = await apiFetch<any>(\`/api/v0/rankings?limit=\${limit}\`)
  return {
    rankings: data,
    count: limit,
    source: 'M-Lab NDT speed tests',
  }
}, { method: 'get_rankings' })

const getHistory = sg.wrap(async (args: HistoryInput) => {
  const country = args.country?.toUpperCase() || 'US'
  const months = args.months ?? 12
  if (months < 1 || months > 60) throw new Error('months must be 1-60')
  if (country.length !== 2) throw new Error('country must be a 2-letter ISO code')
  const data = await apiFetch<any>(\`/api/v0/history?country=\${country}&months=\${months}\`)
  return {
    country,
    months,
    history: data,
    source: 'M-Lab NDT speed tests',
  }
}, { method: 'get_history' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getStats, getRankings, getHistory }

console.log('settlegrid-internet-speed MCP server ready')
console.log('Methods: get_stats, get_rankings, get_history')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`
})

// ─── 207: Downdetector ──────────────────────────────────────────────────────
gen({
  slug: 'downdetector',
  title: 'Service Outage Monitor',
  desc: 'Check if websites and services are down, track recent outages, and monitor availability.',
  api: { base: 'https://www.isitdownrightnow.com', name: 'IsItDownRightNow', docs: 'https://www.isitdownrightnow.com/' },
  key: null,
  keywords: ['outage', 'downtime', 'monitoring', 'status', 'availability'],
  methods: [
    { name: 'check_status', display: 'Check if a domain/service is currently up or down', cost: 1, params: 'domain', inputs: [
      { name: 'domain', type: 'string', required: true, desc: 'Domain name to check (e.g. google.com)' },
    ]},
    { name: 'get_recent_outages', display: 'Get recently reported outages', cost: 1, params: 'limit?', inputs: [
      { name: 'limit', type: 'number', required: false, desc: 'Number of results (default 10)' },
    ]},
    { name: 'list_services', display: 'List popular services monitored', cost: 1, params: '', inputs: []},
  ],
  serverTs: `/**
 * settlegrid-downdetector — Service Outage Monitor MCP Server
 *
 * Wraps public service status checking with SettleGrid billing.
 * No API key needed — uses public HTTP checks.
 *
 * Methods:
 *   check_status(domain) — Check if service is up (1¢)
 *   get_recent_outages(limit?) — Recent outages (1¢)
 *   list_services() — Monitored services (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface StatusInput { domain: string }
interface OutagesInput { limit?: number }

interface StatusResult {
  domain: string
  is_up: boolean
  response_time_ms: number | null
  status_code: number | null
  checked_at: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const POPULAR_SERVICES = [
  'google.com', 'youtube.com', 'facebook.com', 'twitter.com', 'instagram.com',
  'reddit.com', 'netflix.com', 'amazon.com', 'github.com', 'discord.com',
  'twitch.tv', 'spotify.com', 'slack.com', 'zoom.us', 'microsoft.com',
  'apple.com', 'cloudflare.com', 'aws.amazon.com', 'azure.microsoft.com',
  'outlook.com', 'gmail.com', 'dropbox.com', 'steam.com', 'paypal.com',
]

function normalizeDomain(domain: string): string {
  let d = domain.trim().toLowerCase()
  d = d.replace(/^https?:\\/\\//, '').replace(/\\/.*$/, '')
  if (!d.includes('.')) throw new Error('Invalid domain format')
  return d
}

async function checkDomain(domain: string): Promise<StatusResult> {
  const start = Date.now()
  try {
    const res = await fetch(\`https://\${domain}\`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
    })
    return {
      domain,
      is_up: res.ok || res.status < 500,
      response_time_ms: Date.now() - start,
      status_code: res.status,
      checked_at: new Date().toISOString(),
    }
  } catch (err) {
    return {
      domain,
      is_up: false,
      response_time_ms: null,
      status_code: null,
      checked_at: new Date().toISOString(),
    }
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'downdetector',
  pricing: {
    defaultCostCents: 1,
    methods: {
      check_status: { costCents: 1, displayName: 'Check Status' },
      get_recent_outages: { costCents: 1, displayName: 'Recent Outages' },
      list_services: { costCents: 1, displayName: 'List Services' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const checkStatus = sg.wrap(async (args: StatusInput) => {
  if (!args.domain) throw new Error('domain is required')
  const domain = normalizeDomain(args.domain)
  return checkDomain(domain)
}, { method: 'check_status' })

const getRecentOutages = sg.wrap(async (args: OutagesInput) => {
  const limit = args.limit ?? 10
  if (limit < 1 || limit > 50) throw new Error('limit must be 1-50')
  const services = POPULAR_SERVICES.slice(0, limit)
  const results = await Promise.all(services.map(d => checkDomain(d)))
  const down = results.filter(r => !r.is_up)
  return {
    checked: results.length,
    down_count: down.length,
    down_services: down,
    all_results: results,
  }
}, { method: 'get_recent_outages' })

const listServices = sg.wrap(async () => {
  return {
    services: POPULAR_SERVICES.map(d => ({ domain: d, category: 'popular' })),
    count: POPULAR_SERVICES.length,
  }
}, { method: 'list_services' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { checkStatus, getRecentOutages, listServices }

console.log('settlegrid-downdetector MCP server ready')
console.log('Methods: check_status, get_recent_outages, list_services')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 208: BGP Data ──────────────────────────────────────────────────────────
gen({
  slug: 'bgp-data',
  title: 'BGP Routing Data',
  desc: 'BGP routing information, ASN details, and prefix announcements via RIPE Stat.',
  api: { base: 'https://stat.ripe.net/data', name: 'RIPE Stat', docs: 'https://stat.ripe.net/docs/data_api' },
  key: null,
  keywords: ['bgp', 'routing', 'asn', 'prefix', 'ripe', 'network'],
  methods: [
    { name: 'get_prefixes', display: 'Get announced prefixes for an ASN', cost: 1, params: 'asn', inputs: [
      { name: 'asn', type: 'string', required: true, desc: 'Autonomous System Number (e.g. AS13335)' },
    ]},
    { name: 'get_routing_status', display: 'Get routing status for a prefix', cost: 1, params: 'prefix', inputs: [
      { name: 'prefix', type: 'string', required: true, desc: 'IP prefix (e.g. 1.0.0.0/24)' },
    ]},
    { name: 'get_asn_info', display: 'Get ASN holder and registration info', cost: 1, params: 'asn', inputs: [
      { name: 'asn', type: 'string', required: true, desc: 'Autonomous System Number (e.g. AS13335)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-bgp-data — BGP Routing Data MCP Server
 *
 * Wraps RIPE Stat API with SettleGrid billing.
 * No API key needed — RIPE Stat is free and public.
 *
 * Methods:
 *   get_prefixes(asn) — Announced prefixes (1¢)
 *   get_routing_status(prefix) — Routing status (1¢)
 *   get_asn_info(asn) — ASN information (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PrefixInput { asn: string }
interface RoutingInput { prefix: string }
interface AsnInput { asn: string }

interface RipeResponse {
  status: string
  data: any
  query_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://stat.ripe.net/data'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function normalizeAsn(asn: string): string {
  const s = asn.trim().toUpperCase()
  return s.startsWith('AS') ? s.replace('AS', '') : s
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bgp-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_prefixes: { costCents: 1, displayName: 'ASN Prefixes' },
      get_routing_status: { costCents: 1, displayName: 'Routing Status' },
      get_asn_info: { costCents: 1, displayName: 'ASN Info' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPrefixes = sg.wrap(async (args: PrefixInput) => {
  if (!args.asn) throw new Error('asn is required')
  const asn = normalizeAsn(args.asn)
  const data = await apiFetch<RipeResponse>(\`/announced-prefixes/data.json?resource=AS\${asn}\`)
  return {
    asn: \`AS\${asn}\`,
    prefixes: data.data?.prefixes || [],
    count: data.data?.prefixes?.length || 0,
    query_id: data.query_id,
  }
}, { method: 'get_prefixes' })

const getRoutingStatus = sg.wrap(async (args: RoutingInput) => {
  if (!args.prefix) throw new Error('prefix is required')
  const data = await apiFetch<RipeResponse>(\`/routing-status/data.json?resource=\${encodeURIComponent(args.prefix)}\`)
  return {
    prefix: args.prefix,
    status: data.data,
    query_id: data.query_id,
  }
}, { method: 'get_routing_status' })

const getAsnInfo = sg.wrap(async (args: AsnInput) => {
  if (!args.asn) throw new Error('asn is required')
  const asn = normalizeAsn(args.asn)
  const data = await apiFetch<RipeResponse>(\`/as-overview/data.json?resource=AS\${asn}\`)
  return {
    asn: \`AS\${asn}\`,
    info: data.data,
    query_id: data.query_id,
  }
}, { method: 'get_asn_info' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPrefixes, getRoutingStatus, getAsnInfo }

console.log('settlegrid-bgp-data MCP server ready')
console.log('Methods: get_prefixes, get_routing_status, get_asn_info')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 209: DNS Lookup ────────────────────────────────────────────────────────
gen({
  slug: 'dns-lookup',
  title: 'DNS Lookup',
  desc: 'DNS resolution via Google DNS-over-HTTPS — A, AAAA, MX, TXT, CNAME, NS records and DNSSEC validation.',
  api: { base: 'https://dns.google/resolve', name: 'Google DNS-over-HTTPS', docs: 'https://developers.google.com/speed/public-dns/docs/doh/json' },
  key: null,
  keywords: ['dns', 'lookup', 'resolve', 'domain', 'records', 'dnssec'],
  methods: [
    { name: 'resolve', display: 'Resolve a domain to IP addresses', cost: 1, params: 'domain, type?', inputs: [
      { name: 'domain', type: 'string', required: true, desc: 'Domain name to resolve' },
      { name: 'type', type: 'string', required: false, desc: 'Record type: A, AAAA, MX, TXT, CNAME, NS, SOA (default A)' },
    ]},
    { name: 'get_records', display: 'Get all DNS records for a domain', cost: 2, params: 'domain', inputs: [
      { name: 'domain', type: 'string', required: true, desc: 'Domain name' },
    ]},
    { name: 'check_dnssec', display: 'Check DNSSEC validation status for a domain', cost: 1, params: 'domain', inputs: [
      { name: 'domain', type: 'string', required: true, desc: 'Domain name to check' },
    ]},
  ],
  serverTs: `/**
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
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function validateDomain(domain: string): string {
  const d = domain.trim().toLowerCase().replace(/^https?:\\/\\//, '').replace(/\\/.*$/, '')
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
  if (!RECORD_TYPES.includes(type)) throw new Error(\`Invalid type. Use: \${RECORD_TYPES.join(', ')}\`)
  const data = await apiFetch<DnsResponse>(\`?name=\${domain}&type=\${type}\`)
  return {
    domain,
    type,
    status: data.Status === 0 ? 'NOERROR' : \`ERROR(\${data.Status})\`,
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
      const data = await apiFetch<DnsResponse>(\`?name=\${domain}&type=\${type}\`)
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
    apiFetch<DnsResponse>(\`?name=\${domain}&type=A&do=1\`),
    apiFetch<DnsResponse>(\`?name=\${domain}&type=DNSKEY&do=1\`).catch(() => null),
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
`
})

// ─── 210: SSL Check ─────────────────────────────────────────────────────────
gen({
  slug: 'ssl-check',
  title: 'SSL Certificate Check',
  desc: 'SSL/TLS certificate analysis and grading via Qualys SSL Labs API.',
  api: { base: 'https://api.ssllabs.com/api/v3', name: 'SSL Labs', docs: 'https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v3.md' },
  key: null,
  keywords: ['ssl', 'tls', 'certificate', 'security', 'https', 'ssllabs'],
  methods: [
    { name: 'analyze', display: 'Start SSL analysis for a host', cost: 2, params: 'host', inputs: [
      { name: 'host', type: 'string', required: true, desc: 'Hostname to analyze (e.g. example.com)' },
    ]},
    { name: 'get_status', display: 'Get SSL analysis status and results', cost: 1, params: 'host', inputs: [
      { name: 'host', type: 'string', required: true, desc: 'Hostname to check' },
    ]},
    { name: 'get_endpoint', display: 'Get detailed endpoint SSL info', cost: 2, params: 'host, ip', inputs: [
      { name: 'host', type: 'string', required: true, desc: 'Hostname' },
      { name: 'ip', type: 'string', required: true, desc: 'Endpoint IP address' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-ssl-check — SSL Certificate Check MCP Server
 *
 * Wraps Qualys SSL Labs API with SettleGrid billing.
 * No API key needed — SSL Labs API is free.
 *
 * Methods:
 *   analyze(host) — Start SSL analysis (2¢)
 *   get_status(host) — Analysis status (1¢)
 *   get_endpoint(host, ip) — Endpoint details (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface AnalyzeInput { host: string }
interface StatusInput { host: string }
interface EndpointInput { host: string; ip: string }

interface SslEndpoint {
  ipAddress: string
  grade: string
  gradeTrustIgnored: string
  hasWarnings: boolean
  isExceptional: boolean
  progress: number
  statusMessage: string
}

interface SslAnalysis {
  host: string
  port: number
  protocol: string
  status: string
  endpoints?: SslEndpoint[]
  startTime: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.ssllabs.com/api/v3'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function validateHost(host: string): string {
  const h = host.trim().toLowerCase().replace(/^https?:\\/\\//, '').replace(/[:\\/].*$/, '')
  if (!h.includes('.')) throw new Error('Invalid hostname')
  return h
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ssl-check',
  pricing: {
    defaultCostCents: 1,
    methods: {
      analyze: { costCents: 2, displayName: 'SSL Analyze' },
      get_status: { costCents: 1, displayName: 'Analysis Status' },
      get_endpoint: { costCents: 2, displayName: 'Endpoint Detail' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const analyze = sg.wrap(async (args: AnalyzeInput) => {
  if (!args.host) throw new Error('host is required')
  const host = validateHost(args.host)
  const data = await apiFetch<SslAnalysis>(\`/analyze?host=\${host}&startNew=on&all=done\`)
  return {
    host: data.host,
    status: data.status,
    endpoints: data.endpoints?.map(e => ({
      ip: e.ipAddress,
      grade: e.grade,
      progress: e.progress,
      status: e.statusMessage,
    })) || [],
    message: data.status === 'DNS' ? 'Analysis started, check status in 60-90 seconds' : undefined,
  }
}, { method: 'analyze' })

const getStatus = sg.wrap(async (args: StatusInput) => {
  if (!args.host) throw new Error('host is required')
  const host = validateHost(args.host)
  const data = await apiFetch<SslAnalysis>(\`/analyze?host=\${host}&all=done\`)
  return {
    host: data.host,
    status: data.status,
    endpoints: data.endpoints?.map(e => ({
      ip: e.ipAddress,
      grade: e.grade,
      warnings: e.hasWarnings,
      progress: e.progress,
      status: e.statusMessage,
    })) || [],
  }
}, { method: 'get_status' })

const getEndpoint = sg.wrap(async (args: EndpointInput) => {
  if (!args.host) throw new Error('host is required')
  if (!args.ip) throw new Error('ip is required')
  const host = validateHost(args.host)
  const data = await apiFetch<any>(\`/getEndpointData?host=\${host}&s=\${args.ip}\`)
  return {
    host,
    ip: args.ip,
    grade: data.grade,
    details: data.details,
    cert: data.cert,
    protocols: data.protocols,
  }
}, { method: 'get_endpoint' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { analyze, getStatus, getEndpoint }

console.log('settlegrid-ssl-check MCP server ready')
console.log('Methods: analyze, get_status, get_endpoint')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`
})

// ─── 211: Port Check ────────────────────────────────────────────────────────
gen({
  slug: 'port-check',
  title: 'Port Availability Check',
  desc: 'Check open ports, scan common ports, and retrieve HTTP headers via HackerTarget.',
  api: { base: 'https://api.hackertarget.com', name: 'HackerTarget', docs: 'https://hackertarget.com/ip-tools/' },
  key: null,
  keywords: ['port', 'scan', 'network', 'security', 'headers', 'tcp'],
  methods: [
    { name: 'check_port', display: 'Check if a specific port is open on a host', cost: 1, params: 'host, port', inputs: [
      { name: 'host', type: 'string', required: true, desc: 'Hostname or IP address' },
      { name: 'port', type: 'number', required: true, desc: 'Port number (1-65535)' },
    ]},
    { name: 'scan_common', display: 'Scan common ports on a host', cost: 2, params: 'host', inputs: [
      { name: 'host', type: 'string', required: true, desc: 'Hostname or IP address to scan' },
    ]},
    { name: 'get_headers', display: 'Retrieve HTTP headers from a URL', cost: 1, params: 'url', inputs: [
      { name: 'url', type: 'string', required: true, desc: 'URL to check headers for' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-port-check — Port Availability Check MCP Server
 *
 * Wraps HackerTarget API with SettleGrid billing.
 * No API key needed — free tier available.
 *
 * Methods:
 *   check_port(host, port) — Check specific port (1¢)
 *   scan_common(host) — Scan common ports (2¢)
 *   get_headers(url) — HTTP headers (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PortInput { host: string; port: number }
interface ScanInput { host: string }
interface HeadersInput { url: string }

interface PortResult {
  host: string
  port: number
  state: string
  service?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.hackertarget.com'

async function apiText(path: string): Promise<string> {
  const url = \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.text()
}

function validateHost(host: string): string {
  const h = host.trim().toLowerCase().replace(/^https?:\\/\\//, '').replace(/[:\\/].*$/, '')
  if (!h) throw new Error('Invalid host')
  return h
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'port-check',
  pricing: {
    defaultCostCents: 1,
    methods: {
      check_port: { costCents: 1, displayName: 'Check Port' },
      scan_common: { costCents: 2, displayName: 'Common Port Scan' },
      get_headers: { costCents: 1, displayName: 'HTTP Headers' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const checkPort = sg.wrap(async (args: PortInput) => {
  if (!args.host) throw new Error('host is required')
  if (!args.port || args.port < 1 || args.port > 65535) throw new Error('port must be 1-65535')
  const host = validateHost(args.host)
  const text = await apiText(\`/nmap?q=\${host} -p \${args.port}\`)
  const isOpen = text.toLowerCase().includes('open')
  return {
    host,
    port: args.port,
    state: isOpen ? 'open' : 'closed/filtered',
    raw: text.trim(),
  }
}, { method: 'check_port' })

const scanCommon = sg.wrap(async (args: ScanInput) => {
  if (!args.host) throw new Error('host is required')
  const host = validateHost(args.host)
  const text = await apiText(\`/nmap?q=\${host}\`)
  const lines = text.trim().split('\\n')
  const ports: PortResult[] = []
  for (const line of lines) {
    const match = line.match(/(\\d+)\\/tcp\\s+(\\S+)\\s+(.*)/)
    if (match) {
      ports.push({ host, port: parseInt(match[1]), state: match[2], service: match[3].trim() })
    }
  }
  return {
    host,
    ports,
    open_count: ports.filter(p => p.state === 'open').length,
    total_scanned: ports.length,
    raw: text.trim(),
  }
}, { method: 'scan_common' })

const getHeaders = sg.wrap(async (args: HeadersInput) => {
  if (!args.url) throw new Error('url is required')
  let url = args.url.trim()
  if (!url.startsWith('http')) url = \`https://\${url}\`
  const text = await apiText(\`/httpheaders?q=\${encodeURIComponent(url)}\`)
  const headers: Record<string, string> = {}
  for (const line of text.trim().split('\\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      headers[line.substring(0, idx).trim()] = line.substring(idx + 1).trim()
    }
  }
  return {
    url,
    headers,
    header_count: Object.keys(headers).length,
    raw: text.trim(),
  }
}, { method: 'get_headers' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { checkPort, scanCommon, getHeaders }

console.log('settlegrid-port-check MCP server ready')
console.log('Methods: check_port, scan_common, get_headers')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`
})

// ─── 212: Ping Check ────────────────────────────────────────────────────────
gen({
  slug: 'ping-check',
  title: 'Ping & Uptime Check',
  desc: 'Ping hosts, run traceroutes, and check HTTP availability via HackerTarget.',
  api: { base: 'https://api.hackertarget.com', name: 'HackerTarget', docs: 'https://hackertarget.com/ip-tools/' },
  key: null,
  keywords: ['ping', 'traceroute', 'uptime', 'monitoring', 'network', 'http'],
  methods: [
    { name: 'ping', display: 'Ping a host and get latency stats', cost: 1, params: 'host', inputs: [
      { name: 'host', type: 'string', required: true, desc: 'Hostname or IP address to ping' },
    ]},
    { name: 'traceroute', display: 'Run a traceroute to a host', cost: 2, params: 'host', inputs: [
      { name: 'host', type: 'string', required: true, desc: 'Hostname or IP address' },
    ]},
    { name: 'check_http', display: 'Check HTTP availability of a URL', cost: 1, params: 'url', inputs: [
      { name: 'url', type: 'string', required: true, desc: 'URL to check (e.g. https://example.com)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-ping-check — Ping & Uptime Check MCP Server
 *
 * Wraps HackerTarget API with SettleGrid billing.
 * No API key needed — free tier available.
 *
 * Methods:
 *   ping(host) — Ping latency stats (1¢)
 *   traceroute(host) — Traceroute (2¢)
 *   check_http(url) — HTTP check (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PingInput { host: string }
interface TracerouteInput { host: string }
interface HttpInput { url: string }

interface PingStats {
  host: string
  packets_sent: number
  packets_received: number
  loss_percent: number
  min_ms: number | null
  avg_ms: number | null
  max_ms: number | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.hackertarget.com'

async function apiText(path: string): Promise<string> {
  const url = \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.text()
}

function validateHost(host: string): string {
  const h = host.trim().toLowerCase().replace(/^https?:\\/\\//, '').replace(/[:\\/].*$/, '')
  if (!h) throw new Error('Invalid host')
  return h
}

function parsePingStats(text: string, host: string): PingStats {
  const lossMatch = text.match(/(\\d+(?:\\.\\d+)?)% packet loss/)
  const rttMatch = text.match(/=\\s*([\\d.]+)\\/([\\d.]+)\\/([\\d.]+)/)
  const sentMatch = text.match(/(\\d+) packets transmitted/)
  const recvMatch = text.match(/(\\d+) (?:packets )?received/)
  return {
    host,
    packets_sent: sentMatch ? parseInt(sentMatch[1]) : 0,
    packets_received: recvMatch ? parseInt(recvMatch[1]) : 0,
    loss_percent: lossMatch ? parseFloat(lossMatch[1]) : 100,
    min_ms: rttMatch ? parseFloat(rttMatch[1]) : null,
    avg_ms: rttMatch ? parseFloat(rttMatch[2]) : null,
    max_ms: rttMatch ? parseFloat(rttMatch[3]) : null,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ping-check',
  pricing: {
    defaultCostCents: 1,
    methods: {
      ping: { costCents: 1, displayName: 'Ping Host' },
      traceroute: { costCents: 2, displayName: 'Traceroute' },
      check_http: { costCents: 1, displayName: 'HTTP Check' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const ping = sg.wrap(async (args: PingInput) => {
  if (!args.host) throw new Error('host is required')
  const host = validateHost(args.host)
  const text = await apiText(\`/ping?q=\${host}\`)
  const stats = parsePingStats(text, host)
  return { ...stats, raw: text.trim() }
}, { method: 'ping' })

const traceroute = sg.wrap(async (args: TracerouteInput) => {
  if (!args.host) throw new Error('host is required')
  const host = validateHost(args.host)
  const text = await apiText(\`/mtr?q=\${host}\`)
  const hops = text.trim().split('\\n').filter(l => l.match(/^\\s*\\d/)).map(line => {
    const parts = line.trim().split(/\\s+/)
    return { hop: parseInt(parts[0]) || 0, host: parts[1] || '*', loss: parts[2] || '', avg_ms: parts[5] || '' }
  })
  return { host, hops, hop_count: hops.length, raw: text.trim() }
}, { method: 'traceroute' })

const checkHttp = sg.wrap(async (args: HttpInput) => {
  if (!args.url) throw new Error('url is required')
  let url = args.url.trim()
  if (!url.startsWith('http')) url = \`https://\${url}\`
  const start = Date.now()
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) })
    return {
      url,
      is_up: res.ok,
      status_code: res.status,
      response_time_ms: Date.now() - start,
      headers: Object.fromEntries(res.headers.entries()),
    }
  } catch (err: any) {
    return {
      url,
      is_up: false,
      status_code: null,
      response_time_ms: Date.now() - start,
      error: err.message,
    }
  }
}, { method: 'check_http' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { ping, traceroute, checkHttp }

console.log('settlegrid-ping-check MCP server ready')
console.log('Methods: ping, traceroute, check_http')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`
})

// ─── 213: CDN Data ──────────────────────────────────────────────────────────
gen({
  slug: 'cdn-data',
  title: 'CDN Performance Data',
  desc: 'CDN traffic analytics, performance statistics, and trends via Cloudflare Radar.',
  api: { base: 'https://radar.cloudflare.com/api', name: 'Cloudflare Radar', docs: 'https://developers.cloudflare.com/radar/' },
  key: null,
  keywords: ['cdn', 'cloudflare', 'traffic', 'performance', 'analytics', 'network'],
  methods: [
    { name: 'get_traffic', display: 'Get internet traffic data', cost: 1, params: 'domain?', inputs: [
      { name: 'domain', type: 'string', required: false, desc: 'Domain to check (omit for global stats)' },
    ]},
    { name: 'get_stats', display: 'Get internet statistics by country', cost: 1, params: 'country?', inputs: [
      { name: 'country', type: 'string', required: false, desc: 'ISO country code (e.g. US)' },
    ]},
    { name: 'get_trends', display: 'Get internet traffic trends', cost: 2, params: 'days?', inputs: [
      { name: 'days', type: 'number', required: false, desc: 'Number of days to look back (default 7)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-cdn-data — CDN Performance Data MCP Server
 *
 * Wraps Cloudflare Radar API with SettleGrid billing.
 * No API key needed — Radar public data is free.
 *
 * Methods:
 *   get_traffic(domain?) — Traffic data (1¢)
 *   get_stats(country?) — Country stats (1¢)
 *   get_trends(days?) — Traffic trends (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TrafficInput { domain?: string }
interface StatsInput { country?: string }
interface TrendsInput { days?: number }

interface RadarResponse {
  success: boolean
  result: any
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://radar.cloudflare.com/api'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function dateRange(days: number): { start: string; end: string } {
  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'cdn-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_traffic: { costCents: 1, displayName: 'Traffic Data' },
      get_stats: { costCents: 1, displayName: 'Country Stats' },
      get_trends: { costCents: 2, displayName: 'Traffic Trends' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTraffic = sg.wrap(async (args: TrafficInput) => {
  const params = new URLSearchParams()
  if (args.domain) params.set('domain', args.domain)
  params.set('dateRange', '7d')
  const data = await apiFetch<RadarResponse>(\`/traffic/top/locations?\${params}\`)
  return {
    domain: args.domain || 'global',
    traffic: data.result,
    period: '7d',
    source: 'Cloudflare Radar',
  }
}, { method: 'get_traffic' })

const getStats = sg.wrap(async (args: StatsInput) => {
  const params = new URLSearchParams()
  if (args.country) {
    if (args.country.length !== 2) throw new Error('country must be a 2-letter ISO code')
    params.set('location', args.country.toUpperCase())
  }
  params.set('dateRange', '7d')
  const data = await apiFetch<RadarResponse>(\`/http/summary/http_protocol?\${params}\`)
  return {
    country: args.country?.toUpperCase() || 'global',
    stats: data.result,
    source: 'Cloudflare Radar',
  }
}, { method: 'get_stats' })

const getTrends = sg.wrap(async (args: TrendsInput) => {
  const days = args.days ?? 7
  if (days < 1 || days > 90) throw new Error('days must be 1-90')
  const { start, end } = dateRange(days)
  const data = await apiFetch<RadarResponse>(\`/http/timeseries/http_protocol?dateStart=\${start}&dateEnd=\${end}\`)
  return {
    period: { start, end, days },
    trends: data.result,
    source: 'Cloudflare Radar',
  }
}, { method: 'get_trends' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTraffic, getStats, getTrends }

console.log('settlegrid-cdn-data MCP server ready')
console.log('Methods: get_traffic, get_stats, get_trends')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`
})

// ─── 214: Cloud Pricing ─────────────────────────────────────────────────────
gen({
  slug: 'cloud-pricing',
  title: 'Cloud Provider Pricing',
  desc: 'Compare cloud provider pricing across Azure, AWS, and GCP retail price catalogs.',
  api: { base: 'https://prices.azure.com/api/retail/prices', name: 'Azure Retail Prices', docs: 'https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices' },
  key: null,
  keywords: ['cloud', 'pricing', 'azure', 'aws', 'gcp', 'cost', 'comparison'],
  methods: [
    { name: 'get_prices', display: 'Get cloud service prices (Azure)', cost: 1, params: 'service?, region?', inputs: [
      { name: 'service', type: 'string', required: false, desc: 'Service name filter (e.g. Virtual Machines)' },
      { name: 'region', type: 'string', required: false, desc: 'Azure region (e.g. eastus)' },
    ]},
    { name: 'compare_services', display: 'Compare pricing for a service type', cost: 2, params: 'service', inputs: [
      { name: 'service', type: 'string', required: true, desc: 'Service to compare (e.g. Virtual Machines, Storage)' },
    ]},
    { name: 'list_regions', display: 'List available cloud regions', cost: 1, params: '', inputs: []},
  ],
  serverTs: `/**
 * settlegrid-cloud-pricing — Cloud Provider Pricing MCP Server
 *
 * Wraps Azure Retail Prices API with SettleGrid billing.
 * No API key needed — Azure pricing API is public.
 *
 * Methods:
 *   get_prices(service?, region?) — Service prices (1¢)
 *   compare_services(service) — Price comparison (2¢)
 *   list_regions() — Available regions (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PricesInput { service?: string; region?: string }
interface CompareInput { service: string }

interface AzurePrice {
  skuId: string
  skuName: string
  serviceName: string
  armRegionName: string
  retailPrice: number
  unitOfMeasure: string
  currencyCode: string
  productName: string
}

interface AzureResponse {
  Items: AzurePrice[]
  NextPageLink: string | null
  Count: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://prices.azure.com/api/retail/prices'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function buildFilter(service?: string, region?: string): string {
  const parts: string[] = []
  if (service) parts.push(\`serviceName eq '\${service}'\`)
  if (region) parts.push(\`armRegionName eq '\${region}'\`)
  return parts.length ? \`?\\$filter=\${encodeURIComponent(parts.join(' and '))}&\\$top=50\` : '?\\$top=50'
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'cloud-pricing',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_prices: { costCents: 1, displayName: 'Cloud Prices' },
      compare_services: { costCents: 2, displayName: 'Compare Services' },
      list_regions: { costCents: 1, displayName: 'List Regions' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPrices = sg.wrap(async (args: PricesInput) => {
  const filter = buildFilter(args.service, args.region)
  const data = await apiFetch<AzureResponse>(filter)
  return {
    items: data.Items.map(i => ({
      sku: i.skuName,
      service: i.serviceName,
      product: i.productName,
      region: i.armRegionName,
      price: i.retailPrice,
      unit: i.unitOfMeasure,
      currency: i.currencyCode,
    })),
    count: data.Count,
    hasMore: !!data.NextPageLink,
  }
}, { method: 'get_prices' })

const compareServices = sg.wrap(async (args: CompareInput) => {
  if (!args.service) throw new Error('service is required')
  const regions = ['eastus', 'westus2', 'westeurope', 'southeastasia']
  const results = await Promise.all(regions.map(async (region) => {
    try {
      const data = await apiFetch<AzureResponse>(buildFilter(args.service, region))
      return { region, items: data.Items.slice(0, 5), count: data.Count }
    } catch { return { region, items: [], count: 0 } }
  }))
  return {
    service: args.service,
    regions: results,
    comparison_regions: regions,
  }
}, { method: 'compare_services' })

const listRegions = sg.wrap(async () => {
  const data = await apiFetch<AzureResponse>('?\\$top=100')
  const regions = [...new Set(data.Items.map(i => i.armRegionName).filter(Boolean))]
  return {
    regions: regions.sort(),
    count: regions.length,
    source: 'Azure Retail Prices API',
  }
}, { method: 'list_regions' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPrices, compareServices, listRegions }

console.log('settlegrid-cloud-pricing MCP server ready')
console.log('Methods: get_prices, compare_services, list_regions')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`
})

// ─── 215: AWS Pricing ───────────────────────────────────────────────────────
gen({
  slug: 'aws-pricing',
  title: 'AWS Service Pricing',
  desc: 'AWS service pricing data from the public AWS Price List API — EC2, S3, Lambda, and more.',
  api: { base: 'https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws', name: 'AWS Price List', docs: 'https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/price-changes.html' },
  key: null,
  keywords: ['aws', 'pricing', 'ec2', 'cloud', 'amazon', 'compute'],
  methods: [
    { name: 'get_ec2_prices', display: 'Get EC2 instance pricing', cost: 2, params: 'region?, type?', inputs: [
      { name: 'region', type: 'string', required: false, desc: 'AWS region (e.g. us-east-1)' },
      { name: 'type', type: 'string', required: false, desc: 'Instance type filter (e.g. m5, t3)' },
    ]},
    { name: 'list_services', display: 'List all AWS services with pricing data', cost: 1, params: '', inputs: []},
    { name: 'get_service_url', display: 'Get pricing JSON URL for an AWS service', cost: 1, params: 'service', inputs: [
      { name: 'service', type: 'string', required: true, desc: 'AWS service code (e.g. AmazonEC2, AmazonS3)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-aws-pricing — AWS Service Pricing MCP Server
 *
 * Wraps AWS Price List API with SettleGrid billing.
 * No API key needed — AWS pricing data is public.
 *
 * Methods:
 *   get_ec2_prices(region?, type?) — EC2 prices (2¢)
 *   list_services() — AWS service list (1¢)
 *   get_service_url(service) — Pricing URL (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Ec2Input { region?: string; type?: string }
interface ServiceUrlInput { service: string }

interface AwsOffer {
  offerCode: string
  currentVersionUrl: string
  currentRegionIndexUrl?: string
}

interface AwsIndex {
  formatVersion: string
  disclaimer: string
  publicationDate: string
  offers: Record<string, AwsOffer>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://pricing.us-east-1.amazonaws.com'
const INDEX_URL = \`\${API_BASE}/offers/v1.0/aws/index.json\`

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'aws-pricing',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_ec2_prices: { costCents: 2, displayName: 'EC2 Pricing' },
      list_services: { costCents: 1, displayName: 'List Services' },
      get_service_url: { costCents: 1, displayName: 'Service URL' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getEc2Prices = sg.wrap(async (args: Ec2Input) => {
  const region = args.region || 'us-east-1'
  const index = await apiFetch<AwsIndex>(INDEX_URL)
  const ec2 = index.offers['AmazonEC2']
  if (!ec2) throw new Error('AmazonEC2 offer not found in index')
  const regionIndexUrl = ec2.currentRegionIndexUrl
  if (!regionIndexUrl) throw new Error('No region index available for EC2')
  const regionIndex = await apiFetch<any>(\`\${API_BASE}\${regionIndexUrl}\`)
  const regionData = regionIndex.regions?.[region]
  if (!regionData) {
    return {
      region,
      available_regions: Object.keys(regionIndex.regions || {}),
      error: \`Region \${region} not found\`,
    }
  }
  return {
    region,
    version_url: regionData.currentVersionUrl,
    type_filter: args.type || 'all',
    publication_date: index.publicationDate,
    source: 'AWS Price List API',
  }
}, { method: 'get_ec2_prices' })

const listServices = sg.wrap(async () => {
  const index = await apiFetch<AwsIndex>(INDEX_URL)
  const services = Object.entries(index.offers).map(([code, offer]) => ({
    code,
    pricing_url: offer.currentVersionUrl,
    has_region_index: !!offer.currentRegionIndexUrl,
  }))
  return {
    services,
    count: services.length,
    publication_date: index.publicationDate,
    source: 'AWS Price List API',
  }
}, { method: 'list_services' })

const getServiceUrl = sg.wrap(async (args: ServiceUrlInput) => {
  if (!args.service) throw new Error('service is required')
  const index = await apiFetch<AwsIndex>(INDEX_URL)
  const offer = index.offers[args.service]
  if (!offer) {
    const available = Object.keys(index.offers).slice(0, 20)
    throw new Error(\`Service '\${args.service}' not found. Try: \${available.join(', ')}\`)
  }
  return {
    service: args.service,
    pricing_url: \`\${API_BASE}\${offer.currentVersionUrl}\`,
    region_index_url: offer.currentRegionIndexUrl ? \`\${API_BASE}\${offer.currentRegionIndexUrl}\` : null,
    source: 'AWS Price List API',
  }
}, { method: 'get_service_url' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getEc2Prices, listServices, getServiceUrl }

console.log('settlegrid-aws-pricing MCP server ready')
console.log('Methods: get_ec2_prices, list_services, get_service_url')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`
})

// ─── 216: GCP Pricing ───────────────────────────────────────────────────────
gen({
  slug: 'gcp-pricing',
  title: 'GCP Service Pricing',
  desc: 'Google Cloud Platform pricing data — compute, storage, networking, and managed services.',
  api: { base: 'https://cloudbilling.googleapis.com/v1', name: 'GCP Cloud Billing', docs: 'https://cloud.google.com/billing/docs/reference/rest' },
  key: null,
  keywords: ['gcp', 'google', 'cloud', 'pricing', 'compute', 'billing'],
  methods: [
    { name: 'get_compute_prices', display: 'Get GCP Compute Engine pricing', cost: 2, params: 'region?', inputs: [
      { name: 'region', type: 'string', required: false, desc: 'GCP region (e.g. us-central1)' },
    ]},
    { name: 'list_services', display: 'List GCP services with billing info', cost: 1, params: '', inputs: []},
    { name: 'get_skus', display: 'Get SKU pricing for a GCP service', cost: 2, params: 'service', inputs: [
      { name: 'service', type: 'string', required: true, desc: 'GCP service ID or name (e.g. Compute Engine)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-gcp-pricing — GCP Service Pricing MCP Server
 *
 * Wraps GCP Cloud Billing catalog with SettleGrid billing.
 * No API key needed — public catalog endpoints.
 *
 * Methods:
 *   get_compute_prices(region?) — Compute pricing (2¢)
 *   list_services() — GCP services (1¢)
 *   get_skus(service) — Service SKUs (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ComputeInput { region?: string }
interface SkusInput { service: string }

interface GcpService {
  name: string
  serviceId: string
  displayName: string
}

interface GcpSku {
  name: string
  skuId: string
  description: string
  category: { serviceDisplayName: string; resourceFamily: string }
  serviceRegions: string[]
  pricingInfo: any[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://cloudbilling.googleapis.com/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const GCP_SERVICES: Record<string, string> = {
  'compute': '6F81-5844-456A',
  'storage': '95FF-2EF5-5EA1',
  'bigquery': '2062-016F-44A2',
  'cloud-sql': '9662-B51E-5089',
  'kubernetes': 'CCD8-9BF1-090E',
  'cloud-functions': '29E7-DA93-CA13',
  'cloud-run': '152E-C115-5142',
  'networking': 'E505-1604-58F8',
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'gcp-pricing',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_compute_prices: { costCents: 2, displayName: 'Compute Prices' },
      list_services: { costCents: 1, displayName: 'List Services' },
      get_skus: { costCents: 2, displayName: 'Service SKUs' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getComputePrices = sg.wrap(async (args: ComputeInput) => {
  const region = args.region || 'us-central1'
  const serviceId = GCP_SERVICES['compute']
  try {
    const data = await apiFetch<any>(\`/services/\${serviceId}/skus?pageSize=50\`)
    const skus = (data.skus || [])
      .filter((s: GcpSku) => !region || s.serviceRegions?.includes(region))
      .slice(0, 25)
      .map((s: GcpSku) => ({
        id: s.skuId,
        description: s.description,
        category: s.category?.resourceFamily,
        regions: s.serviceRegions?.slice(0, 5),
        pricing: s.pricingInfo?.[0],
      }))
    return { region, skus, count: skus.length, source: 'GCP Cloud Billing API' }
  } catch {
    return {
      region,
      note: 'GCP Billing API requires authentication for SKU data. Use list_services for public catalog info.',
      known_services: Object.keys(GCP_SERVICES),
      source: 'GCP Cloud Billing API',
    }
  }
}, { method: 'get_compute_prices' })

const listServices = sg.wrap(async () => {
  try {
    const data = await apiFetch<any>('/services?pageSize=50')
    const services = (data.services || []).map((s: GcpService) => ({
      id: s.serviceId,
      name: s.displayName,
      resource: s.name,
    }))
    return { services, count: services.length, source: 'GCP Cloud Billing API' }
  } catch {
    const services = Object.entries(GCP_SERVICES).map(([name, id]) => ({ name, id }))
    return {
      services,
      count: services.length,
      note: 'Returning cached service list — API may require auth.',
      source: 'GCP Cloud Billing API',
    }
  }
}, { method: 'list_services' })

const getSkus = sg.wrap(async (args: SkusInput) => {
  if (!args.service) throw new Error('service is required')
  const serviceKey = args.service.toLowerCase().replace(/\\s+/g, '-')
  const serviceId = GCP_SERVICES[serviceKey] || args.service
  try {
    const data = await apiFetch<any>(\`/services/\${serviceId}/skus?pageSize=25\`)
    const skus = (data.skus || []).map((s: GcpSku) => ({
      id: s.skuId,
      description: s.description,
      category: s.category,
      regions: s.serviceRegions?.slice(0, 5),
    }))
    return { service: args.service, service_id: serviceId, skus, count: skus.length }
  } catch {
    return {
      service: args.service,
      service_id: serviceId,
      note: 'SKU data may require authentication. Known service IDs:',
      known_services: GCP_SERVICES,
    }
  }
}, { method: 'get_skus' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getComputePrices, listServices, getSkus }

console.log('settlegrid-gcp-pricing MCP server ready')
console.log('Methods: get_compute_prices, list_services, get_skus')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`
})

// ─── 217: Azure Pricing ─────────────────────────────────────────────────────
gen({
  slug: 'azure-pricing',
  title: 'Azure Service Pricing',
  desc: 'Azure retail pricing data — VMs, storage, databases, networking, and all Azure services.',
  api: { base: 'https://prices.azure.com/api/retail/prices', name: 'Azure Retail Prices', docs: 'https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices' },
  key: null,
  keywords: ['azure', 'microsoft', 'cloud', 'pricing', 'vm', 'compute'],
  methods: [
    { name: 'get_prices', display: 'Get Azure service prices with filters', cost: 1, params: 'service?, region?', inputs: [
      { name: 'service', type: 'string', required: false, desc: 'Service name (e.g. Virtual Machines, Storage)' },
      { name: 'region', type: 'string', required: false, desc: 'Azure region (e.g. eastus, westeurope)' },
    ]},
    { name: 'search_skus', display: 'Search Azure SKUs by keyword', cost: 1, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search keyword (e.g. D2s, Standard_B)' },
    ]},
    { name: 'list_services', display: 'List available Azure services', cost: 1, params: '', inputs: []},
  ],
  serverTs: `/**
 * settlegrid-azure-pricing — Azure Service Pricing MCP Server
 *
 * Wraps Azure Retail Prices API with SettleGrid billing.
 * No API key needed — Azure pricing API is public.
 *
 * Methods:
 *   get_prices(service?, region?) — Azure prices (1¢)
 *   search_skus(query) — Search SKUs (1¢)
 *   list_services() — Service list (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PricesInput { service?: string; region?: string }
interface SearchInput { query: string }

interface AzurePrice {
  skuId: string
  skuName: string
  serviceName: string
  armRegionName: string
  retailPrice: number
  unitOfMeasure: string
  currencyCode: string
  productName: string
  meterName: string
  type: string
}

interface AzureResponse {
  Items: AzurePrice[]
  NextPageLink: string | null
  Count: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://prices.azure.com/api/retail/prices'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatPrice(item: AzurePrice) {
  return {
    sku: item.skuName,
    service: item.serviceName,
    product: item.productName,
    meter: item.meterName,
    region: item.armRegionName,
    price: item.retailPrice,
    unit: item.unitOfMeasure,
    currency: item.currencyCode,
    type: item.type,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'azure-pricing',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_prices: { costCents: 1, displayName: 'Azure Prices' },
      search_skus: { costCents: 1, displayName: 'Search SKUs' },
      list_services: { costCents: 1, displayName: 'List Services' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPrices = sg.wrap(async (args: PricesInput) => {
  const parts: string[] = []
  if (args.service) parts.push(\`serviceName eq '\${args.service}'\`)
  if (args.region) parts.push(\`armRegionName eq '\${args.region}'\`)
  const filter = parts.length ? \`?\\$filter=\${encodeURIComponent(parts.join(' and '))}&\\$top=50\` : '?\\$top=50'
  const data = await apiFetch<AzureResponse>(filter)
  return {
    items: data.Items.map(formatPrice),
    count: data.Count,
    has_more: !!data.NextPageLink,
    filters: { service: args.service, region: args.region },
  }
}, { method: 'get_prices' })

const searchSkus = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const filter = \`?\\$filter=contains(skuName, '\${args.query}')&\\$top=30\`
  const data = await apiFetch<AzureResponse>(filter)
  return {
    query: args.query,
    items: data.Items.map(formatPrice),
    count: data.Count,
    has_more: !!data.NextPageLink,
  }
}, { method: 'search_skus' })

const listServices = sg.wrap(async () => {
  const data = await apiFetch<AzureResponse>('?\\$top=100')
  const services = [...new Set(data.Items.map(i => i.serviceName).filter(Boolean))].sort()
  return {
    services,
    count: services.length,
    note: 'Partial list from first 100 items. Use get_prices with service filter for full data.',
    source: 'Azure Retail Prices API',
  }
}, { method: 'list_services' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPrices, searchSkus, listServices }

console.log('settlegrid-azure-pricing MCP server ready')
console.log('Methods: get_prices, search_skus, list_services')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 218: Data Center Locations ─────────────────────────────────────────────
gen({
  slug: 'data-center',
  title: 'Data Center Locations',
  desc: 'Global data center locations, specifications, and statistics from public datasets.',
  api: { base: 'https://api.datacentermap.com', name: 'DataCenterMap', docs: 'https://www.datacentermap.com/' },
  key: null,
  keywords: ['datacenter', 'colocation', 'infrastructure', 'hosting', 'locations'],
  methods: [
    { name: 'search_datacenters', display: 'Search data centers by location', cost: 1, params: 'country?, city?', inputs: [
      { name: 'country', type: 'string', required: false, desc: 'Country name or ISO code' },
      { name: 'city', type: 'string', required: false, desc: 'City name' },
    ]},
    { name: 'get_datacenter', display: 'Get data center details by ID', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Data center ID' },
    ]},
    { name: 'get_stats', display: 'Get data center statistics by country', cost: 1, params: 'country?', inputs: [
      { name: 'country', type: 'string', required: false, desc: 'Country name or ISO code' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-data-center — Data Center Locations MCP Server
 *
 * Wraps data center location data with SettleGrid billing.
 * No API key needed — uses public datasets.
 *
 * Methods:
 *   search_datacenters(country?, city?) — Search locations (1¢)
 *   get_datacenter(id) — Data center details (1¢)
 *   get_stats(country?) — Country stats (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { country?: string; city?: string }
interface DetailInput { id: string }
interface StatsInput { country?: string }

interface DataCenter {
  id: string
  name: string
  provider: string
  country: string
  city: string
  lat?: number
  lon?: number
  tier?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.datacentermap.com'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const DC_HUBS: Record<string, { count: number; major_cities: string[] }> = {
  US: { count: 2670, major_cities: ['Ashburn', 'Dallas', 'Chicago', 'Phoenix', 'Los Angeles', 'New York'] },
  DE: { count: 487, major_cities: ['Frankfurt', 'Munich', 'Berlin', 'Hamburg', 'Dusseldorf'] },
  GB: { count: 452, major_cities: ['London', 'Manchester', 'Birmingham', 'Edinburgh'] },
  NL: { count: 288, major_cities: ['Amsterdam', 'Rotterdam', 'The Hague'] },
  CN: { count: 449, major_cities: ['Beijing', 'Shanghai', 'Shenzhen', 'Guangzhou'] },
  JP: { count: 207, major_cities: ['Tokyo', 'Osaka', 'Nagoya'] },
  AU: { count: 289, major_cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth'] },
  SG: { count: 73, major_cities: ['Singapore'] },
  IN: { count: 138, major_cities: ['Mumbai', 'Chennai', 'Hyderabad', 'Pune'] },
  BR: { count: 147, major_cities: ['Sao Paulo', 'Rio de Janeiro', 'Campinas'] },
  CA: { count: 282, major_cities: ['Toronto', 'Montreal', 'Vancouver', 'Calgary'] },
  FR: { count: 263, major_cities: ['Paris', 'Marseille', 'Lyon'] },
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'data-center',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datacenters: { costCents: 1, displayName: 'Search Data Centers' },
      get_datacenter: { costCents: 1, displayName: 'Data Center Details' },
      get_stats: { costCents: 1, displayName: 'DC Statistics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatacenters = sg.wrap(async (args: SearchInput) => {
  const params = new URLSearchParams()
  if (args.country) params.set('country', args.country)
  if (args.city) params.set('city', args.city)
  try {
    const data = await apiFetch<any>(\`/v1/datacenters?\${params}\`)
    return { query: { country: args.country, city: args.city }, results: data, source: 'DataCenterMap' }
  } catch {
    const country = args.country?.toUpperCase() || ''
    const hub = DC_HUBS[country]
    return {
      query: { country: args.country, city: args.city },
      estimated_count: hub?.count || 'unknown',
      major_cities: hub?.major_cities || [],
      note: 'Live API unavailable — returning cached hub data.',
      available_countries: Object.keys(DC_HUBS),
      source: 'DataCenterMap (cached)',
    }
  }
}, { method: 'search_datacenters' })

const getDatacenter = sg.wrap(async (args: DetailInput) => {
  if (!args.id) throw new Error('id is required')
  try {
    const data = await apiFetch<any>(\`/v1/datacenters/\${args.id}\`)
    return { datacenter: data, source: 'DataCenterMap' }
  } catch {
    return {
      id: args.id,
      note: 'Data center not found or API unavailable. Try search_datacenters to find valid IDs.',
      source: 'DataCenterMap',
    }
  }
}, { method: 'get_datacenter' })

const getStats = sg.wrap(async (args: StatsInput) => {
  if (args.country) {
    const code = args.country.toUpperCase()
    const hub = DC_HUBS[code]
    if (!hub) {
      return {
        country: code,
        error: \`No data for \${code}\`,
        available: Object.keys(DC_HUBS),
      }
    }
    return {
      country: code,
      estimated_datacenters: hub.count,
      major_cities: hub.major_cities,
      source: 'DataCenterMap',
    }
  }
  const total = Object.values(DC_HUBS).reduce((s, h) => s + h.count, 0)
  const ranked = Object.entries(DC_HUBS)
    .map(([code, h]) => ({ country: code, count: h.count, cities: h.major_cities }))
    .sort((a, b) => b.count - a.count)
  return {
    global_total: total,
    countries_tracked: Object.keys(DC_HUBS).length,
    rankings: ranked,
    source: 'DataCenterMap',
  }
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatacenters, getDatacenter, getStats }

console.log('settlegrid-data-center MCP server ready')
console.log('Methods: search_datacenters, get_datacenter, get_stats')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 219: Submarine Cables ──────────────────────────────────────────────────
gen({
  slug: 'submarine-cables',
  title: 'Submarine Cable Data',
  desc: 'Undersea fiber optic cable routes, landing points, and capacity data from TeleGeography.',
  api: { base: 'https://api.submarinecablemap.com/api/v3', name: 'TeleGeography Submarine Cable Map', docs: 'https://www.submarinecablemap.com/' },
  key: null,
  keywords: ['submarine', 'cables', 'undersea', 'fiber', 'telegeography', 'telecom'],
  methods: [
    { name: 'list_cables', display: 'List submarine cables', cost: 1, params: 'limit?', inputs: [
      { name: 'limit', type: 'number', required: false, desc: 'Number of cables to return (default 25)' },
    ]},
    { name: 'get_cable', display: 'Get submarine cable details by ID', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Cable ID or slug' },
    ]},
    { name: 'list_landing_points', display: 'List cable landing points by country', cost: 1, params: 'country?', inputs: [
      { name: 'country', type: 'string', required: false, desc: 'Country name to filter landing points' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-submarine-cables — Submarine Cable Data MCP Server
 *
 * Wraps TeleGeography Submarine Cable Map API with SettleGrid billing.
 * No API key needed — the API is free and public.
 *
 * Methods:
 *   list_cables(limit?) — List cables (1¢)
 *   get_cable(id) — Cable details (1¢)
 *   list_landing_points(country?) — Landing points (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListInput { limit?: number }
interface CableInput { id: string }
interface LandingInput { country?: string }

interface Cable {
  id: string
  name: string
  color: string
  length: string
  rfs: string
  owners: string
  url: string
  is_planned: boolean
}

interface LandingPoint {
  id: string
  name: string
  country: string
  latitude: number
  longitude: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.submarinecablemap.com/api/v3'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'submarine-cables',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_cables: { costCents: 1, displayName: 'List Cables' },
      get_cable: { costCents: 1, displayName: 'Cable Details' },
      list_landing_points: { costCents: 1, displayName: 'Landing Points' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listCables = sg.wrap(async (args: ListInput) => {
  const limit = args.limit ?? 25
  if (limit < 1 || limit > 500) throw new Error('limit must be 1-500')
  const cables = await apiFetch<Cable[]>('/cable/all.json')
  const sorted = cables.sort((a, b) => {
    const ya = parseInt(a.rfs) || 0
    const yb = parseInt(b.rfs) || 0
    return yb - ya
  })
  return {
    cables: sorted.slice(0, limit).map(c => ({
      id: c.id,
      name: c.name,
      length: c.length,
      ready_for_service: c.rfs,
      owners: c.owners,
      is_planned: c.is_planned,
    })),
    total: cables.length,
    returned: Math.min(limit, cables.length),
    source: 'TeleGeography Submarine Cable Map',
  }
}, { method: 'list_cables' })

const getCable = sg.wrap(async (args: CableInput) => {
  if (!args.id) throw new Error('id is required')
  const cable = await apiFetch<any>(\`/cable/\${args.id}.json\`)
  return {
    cable: {
      id: cable.id,
      name: cable.name,
      color: cable.color,
      length: cable.length,
      ready_for_service: cable.rfs,
      owners: cable.owners,
      url: cable.url,
      is_planned: cable.is_planned,
      landing_points: cable.landing_points,
    },
    source: 'TeleGeography Submarine Cable Map',
  }
}, { method: 'get_cable' })

const listLandingPoints = sg.wrap(async (args: LandingInput) => {
  const points = await apiFetch<LandingPoint[]>('/landing-point/all.json')
  let filtered = points
  if (args.country) {
    const country = args.country.toLowerCase()
    filtered = points.filter(p => p.country?.toLowerCase().includes(country))
  }
  return {
    landing_points: filtered.slice(0, 100).map(p => ({
      id: p.id,
      name: p.name,
      country: p.country,
      lat: p.latitude,
      lon: p.longitude,
    })),
    total: filtered.length,
    filter: args.country || 'all',
    source: 'TeleGeography Submarine Cable Map',
  }
}, { method: 'list_landing_points' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listCables, getCable, listLandingPoints }

console.log('settlegrid-submarine-cables MCP server ready')
console.log('Methods: list_cables, get_cable, list_landing_points')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 220: Spectrum Data ─────────────────────────────────────────────────────
gen({
  slug: 'spectrum',
  title: 'Radio Spectrum Data',
  desc: 'FCC radio spectrum license data, allocations, and wireless frequency information.',
  api: { base: 'https://opendata.fcc.gov/api', name: 'FCC Open Data', docs: 'https://opendata.fcc.gov/' },
  key: null,
  keywords: ['spectrum', 'radio', 'fcc', 'wireless', 'frequency', 'telecom', 'license'],
  methods: [
    { name: 'search_licenses', display: 'Search FCC spectrum licenses', cost: 1, params: 'query?, state?', inputs: [
      { name: 'query', type: 'string', required: false, desc: 'Search term (licensee name, frequency, etc.)' },
      { name: 'state', type: 'string', required: false, desc: 'US state code (e.g. CA, NY, TX)' },
    ]},
    { name: 'get_license', display: 'Get detailed license info by ID', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'FCC license ID' },
    ]},
    { name: 'get_allocation', display: 'Get frequency band allocation info', cost: 1, params: 'band?', inputs: [
      { name: 'band', type: 'string', required: false, desc: 'Frequency band (e.g. 700MHz, 2.4GHz, 5GHz)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-spectrum — Radio Spectrum Data MCP Server
 *
 * Wraps FCC Open Data API with SettleGrid billing.
 * No API key needed — FCC data is public.
 *
 * Methods:
 *   search_licenses(query?, state?) — Search licenses (1¢)
 *   get_license(id) — License details (1¢)
 *   get_allocation(band?) — Band allocation (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query?: string; state?: string }
interface LicenseInput { id: string }
interface AllocationInput { band?: string }

interface FccLicense {
  licenseId: string
  licName: string
  frqBand: string
  callSign: string
  status: string
  serviceDesc: string
  state: string
  marketDesc: string
  expDate: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://opendata.fcc.gov/api'
const LICENSE_API = 'https://data.fcc.gov/api/license-view/basicSearch/getLicenses'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const SPECTRUM_BANDS: Record<string, { range: string; use: string; notes: string }> = {
  '700mhz': { range: '698-806 MHz', use: 'LTE/5G cellular', notes: 'First responder (Band 14), T-Mobile, AT&T' },
  '850mhz': { range: '824-894 MHz', use: 'Cellular (GSM/CDMA)', notes: 'Legacy cellular bands' },
  '900mhz': { range: '896-960 MHz', use: 'Narrowband IoT, SMR', notes: 'Industrial/enterprise' },
  '1.7ghz': { range: '1710-1755 MHz', use: 'AWS cellular', notes: 'AWS-1 band' },
  '1.9ghz': { range: '1850-1995 MHz', use: 'PCS cellular', notes: 'Major cellular band' },
  '2.4ghz': { range: '2400-2483.5 MHz', use: 'WiFi, Bluetooth, ISM', notes: 'Unlicensed ISM band' },
  '2.5ghz': { range: '2496-2690 MHz', use: '5G mid-band', notes: 'T-Mobile 5G primary' },
  '3.5ghz': { range: '3550-3700 MHz', use: 'CBRS/5G', notes: 'Citizens Broadband Radio Service' },
  '5ghz': { range: '5150-5850 MHz', use: 'WiFi 5/6, U-NII', notes: 'Unlicensed/shared' },
  '6ghz': { range: '5925-7125 MHz', use: 'WiFi 6E', notes: 'Newly opened for unlicensed use' },
  '24ghz': { range: '24.25-27.5 GHz', use: '5G mmWave', notes: 'Ultra-high bandwidth' },
  '28ghz': { range: '27.5-28.35 GHz', use: '5G mmWave', notes: 'Verizon 5G primary' },
  '37ghz': { range: '37-40 GHz', use: '5G mmWave', notes: 'High-capacity 5G' },
  '39ghz': { range: '38.6-40 GHz', use: '5G mmWave', notes: 'T-Mobile, AT&T 5G' },
  '47ghz': { range: '47.2-48.2 GHz', use: '5G mmWave', notes: 'Future 5G expansion' },
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'spectrum',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_licenses: { costCents: 1, displayName: 'Search Licenses' },
      get_license: { costCents: 1, displayName: 'License Details' },
      get_allocation: { costCents: 1, displayName: 'Band Allocation' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchLicenses = sg.wrap(async (args: SearchInput) => {
  const query = args.query || 'wireless'
  const params = new URLSearchParams({ searchValue: query, format: 'json', limit: '25' })
  if (args.state) {
    if (args.state.length !== 2) throw new Error('state must be a 2-letter US state code')
    params.set('stateCode', args.state.toUpperCase())
  }
  try {
    const data = await apiFetch<any>(\`\${LICENSE_API}?\${params}\`)
    const licenses = data.Licenses?.License || []
    return {
      query,
      state: args.state?.toUpperCase(),
      licenses: Array.isArray(licenses)
        ? licenses.slice(0, 25).map((l: any) => ({
            id: l.licenseId,
            name: l.licName,
            callSign: l.callSign,
            service: l.serviceDesc,
            status: l.status,
            state: l.state,
            expiration: l.expDate,
          }))
        : [],
      count: data.Licenses?.totalRows || 0,
      source: 'FCC License View',
    }
  } catch (err: any) {
    return {
      query,
      state: args.state,
      error: err.message,
      note: 'FCC API may be temporarily unavailable. Try again later.',
      source: 'FCC License View',
    }
  }
}, { method: 'search_licenses' })

const getLicense = sg.wrap(async (args: LicenseInput) => {
  if (!args.id) throw new Error('id is required')
  try {
    const data = await apiFetch<any>(\`\${LICENSE_API}?searchValue=\${args.id}&format=json\`)
    const license = data.Licenses?.License
    if (!license) throw new Error(\`License \${args.id} not found\`)
    const l = Array.isArray(license) ? license[0] : license
    return {
      id: l.licenseId,
      name: l.licName,
      callSign: l.callSign,
      frqBand: l.frqBand,
      service: l.serviceDesc,
      status: l.status,
      state: l.state,
      market: l.marketDesc,
      expiration: l.expDate,
      grantDate: l.grantDate,
      source: 'FCC License View',
    }
  } catch (err: any) {
    return { id: args.id, error: err.message, source: 'FCC License View' }
  }
}, { method: 'get_license' })

const getAllocation = sg.wrap(async (args: AllocationInput) => {
  if (args.band) {
    const key = args.band.toLowerCase().replace(/\\s+/g, '')
    const band = SPECTRUM_BANDS[key]
    if (!band) {
      return {
        query: args.band,
        error: \`Band '\${args.band}' not found\`,
        available_bands: Object.keys(SPECTRUM_BANDS),
      }
    }
    return { band: key, ...band, source: 'FCC Spectrum Allocation' }
  }
  const bands = Object.entries(SPECTRUM_BANDS).map(([key, info]) => ({
    band: key,
    ...info,
  }))
  return {
    bands,
    count: bands.length,
    source: 'FCC Spectrum Allocation',
  }
}, { method: 'get_allocation' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchLicenses, getLicense, getAllocation }

console.log('settlegrid-spectrum MCP server ready')
console.log('Methods: search_licenses, get_license, get_allocation')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

console.log('\n=== Batch 3F2 complete: 15 Infrastructure/Telecom servers generated ===\n')
