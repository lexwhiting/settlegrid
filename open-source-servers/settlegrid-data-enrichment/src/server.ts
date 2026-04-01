/**
 * settlegrid-data-enrichment — Data Enrichment MCP Server
 *
 * Enrich domains, IPs, and emails with public information.
 * Uses free APIs (ipapi.co, DNS) — no API key needed.
 *
 * Methods:
 *   enrich_domain(domain)  — DNS + HTTP header analysis              (2¢)
 *   enrich_ip(ip)          — IP geolocation via ipapi.co             (2¢)
 *   enrich_email(email)    — Validation + domain MX lookup           (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'
import { resolve, Resolver } from 'node:dns/promises'

// ─── Types ──────────────────────────────────────────────────────────────────

interface EnrichDomainInput {
  domain: string
}

interface EnrichIpInput {
  ip: string
}

interface EnrichEmailInput {
  email: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const USER_AGENT = 'settlegrid-data-enrichment/1.0 (contact@settlegrid.ai)'

const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
const IPV4_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
const IPV6_REGEX = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/

function isValidIp(ip: string): boolean {
  const v4Match = ip.match(IPV4_REGEX)
  if (v4Match) {
    return v4Match.slice(1).every(octet => {
      const n = parseInt(octet, 10)
      return n >= 0 && n <= 255
    })
  }
  return IPV6_REGEX.test(ip)
}

function isPrivateIp(ip: string): boolean {
  const v4Match = ip.match(IPV4_REGEX)
  if (!v4Match) return false
  const [a, b] = v4Match.slice(1).map(Number)
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 127
}

async function fetchWithTimeout<T>(url: string, timeoutMs: number = 10_000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
    }
    return res.json() as Promise<T>
  } finally {
    clearTimeout(timer)
  }
}

async function fetchHeaders(url: string, timeoutMs: number = 10_000): Promise<Record<string, string>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
      redirect: 'follow',
    })
    const headers: Record<string, string> = {}
    res.headers.forEach((value, key) => {
      headers[key] = value
    })
    return headers
  } finally {
    clearTimeout(timer)
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'data-enrichment',
  pricing: {
    defaultCostCents: 2,
    methods: {
      enrich_domain: { costCents: 2, displayName: 'Domain Enrichment' },
      enrich_ip: { costCents: 2, displayName: 'IP Enrichment' },
      enrich_email: { costCents: 2, displayName: 'Email Enrichment' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const enrichDomain = sg.wrap(async (args: EnrichDomainInput) => {
  if (!args.domain || typeof args.domain !== 'string') {
    throw new Error('domain is required (e.g. "example.com", "github.com")')
  }

  const domain = args.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!DOMAIN_REGEX.test(domain)) {
    throw new Error(`Invalid domain format: "${args.domain}". Provide a valid domain like "example.com"`)
  }

  const resolver = new Resolver()
  resolver.setServers(['8.8.8.8', '1.1.1.1'])

  // Run DNS lookups and HTTP header fetch in parallel
  const [aRecords, aaaaRecords, mxRecords, txtRecords, nsRecords, headers] = await Promise.allSettled([
    resolver.resolve4(domain),
    resolver.resolve6(domain),
    resolver.resolveMx(domain),
    resolver.resolveTxt(domain),
    resolver.resolveNs(domain),
    fetchHeaders(`https://${domain}`).catch(() => fetchHeaders(`http://${domain}`)),
  ])

  const ips = aRecords.status === 'fulfilled' ? aRecords.value : []
  const ipv6 = aaaaRecords.status === 'fulfilled' ? aaaaRecords.value : []
  const mx = mxRecords.status === 'fulfilled'
    ? mxRecords.value.sort((a, b) => a.priority - b.priority).map(r => ({ exchange: r.exchange, priority: r.priority }))
    : []
  const txt = txtRecords.status === 'fulfilled' ? txtRecords.value.map(r => r.join('')) : []
  const ns = nsRecords.status === 'fulfilled' ? nsRecords.value : []
  const httpHeaders = headers.status === 'fulfilled' ? headers.value : null

  // Extract useful info from headers
  const server = httpHeaders?.['server'] ?? null
  const poweredBy = httpHeaders?.['x-powered-by'] ?? null
  const contentType = httpHeaders?.['content-type'] ?? null
  const hasSSL = headers.status === 'fulfilled'
  const hasSPF = txt.some(r => r.startsWith('v=spf1'))
  const hasDMARC = txt.some(r => r.startsWith('v=DMARC1'))
  const hasDKIM = txt.some(r => r.includes('DKIM'))

  return {
    domain,
    dns: {
      ipv4: ips,
      ipv6,
      mx,
      nameservers: ns,
      txtRecordCount: txt.length,
    },
    http: httpHeaders ? {
      server,
      poweredBy,
      contentType,
      hasSSL,
    } : null,
    security: {
      hasSPF,
      hasDMARC,
      hasDKIM,
      hasMailServer: mx.length > 0,
    },
  }
}, { method: 'enrich_domain' })

const enrichIp = sg.wrap(async (args: EnrichIpInput) => {
  if (!args.ip || typeof args.ip !== 'string') {
    throw new Error('ip is required (e.g. "8.8.8.8", "2001:4860:4860::8888")')
  }

  const ip = args.ip.trim()
  if (!isValidIp(ip)) {
    throw new Error(`Invalid IP address: "${args.ip}". Provide a valid IPv4 or IPv6 address.`)
  }

  if (isPrivateIp(ip)) {
    return {
      ip,
      isPrivate: true,
      message: 'This is a private/reserved IP address — no geolocation data available',
    }
  }

  const data = await fetchWithTimeout<{
    ip: string
    city: string
    region: string
    region_code: string
    country: string
    country_name: string
    country_code: string
    continent_code: string
    postal: string
    latitude: number
    longitude: number
    timezone: string
    utc_offset: string
    asn: string
    org: string
    isp: string
    currency: string
    languages: string
    country_area: number
    country_population: number
  }>(`https://ipapi.co/${ip}/json/`)

  return {
    ip: data.ip,
    isPrivate: false,
    location: {
      city: data.city,
      region: data.region,
      regionCode: data.region_code,
      country: data.country_name,
      countryCode: data.country_code,
      continentCode: data.continent_code,
      postalCode: data.postal,
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezone,
      utcOffset: data.utc_offset,
    },
    network: {
      asn: data.asn,
      organization: data.org,
      isp: data.isp,
    },
    country: {
      currency: data.currency,
      languages: data.languages,
      area: data.country_area,
      population: data.country_population,
    },
  }
}, { method: 'enrich_ip' })

const enrichEmail = sg.wrap(async (args: EnrichEmailInput) => {
  if (!args.email || typeof args.email !== 'string') {
    throw new Error('email is required (e.g. "user@example.com")')
  }

  const email = args.email.trim().toLowerCase()
  if (!EMAIL_REGEX.test(email)) {
    throw new Error(`Invalid email format: "${args.email}". Provide a valid email address.`)
  }

  const [localPart, domain] = email.split('@')
  if (!domain) {
    throw new Error('Invalid email — missing domain part')
  }

  const resolver = new Resolver()
  resolver.setServers(['8.8.8.8', '1.1.1.1'])

  const [mxRecords, aRecords] = await Promise.allSettled([
    resolver.resolveMx(domain),
    resolver.resolve4(domain),
  ])

  const mx = mxRecords.status === 'fulfilled'
    ? mxRecords.value.sort((a, b) => a.priority - b.priority).map(r => ({ exchange: r.exchange, priority: r.priority }))
    : []
  const hasValidDomain = aRecords.status === 'fulfilled' && aRecords.value.length > 0

  // Detect common providers
  const PROVIDERS: Record<string, string> = {
    'gmail.com': 'Google Gmail',
    'googlemail.com': 'Google Gmail',
    'outlook.com': 'Microsoft Outlook',
    'hotmail.com': 'Microsoft Hotmail',
    'live.com': 'Microsoft Live',
    'yahoo.com': 'Yahoo Mail',
    'icloud.com': 'Apple iCloud',
    'me.com': 'Apple iCloud',
    'mac.com': 'Apple iCloud',
    'protonmail.com': 'Proton Mail',
    'proton.me': 'Proton Mail',
    'aol.com': 'AOL Mail',
    'zoho.com': 'Zoho Mail',
  }

  const provider = PROVIDERS[domain] ?? null
  const isFreeMail = provider !== null
  const isDisposable = /^(tempmail|throwaway|guerrilla|mailinator|yopmail|sharklasers|grr\.la|10minutemail)/.test(domain)

  // Detect role-based addresses
  const ROLE_PREFIXES = new Set([
    'admin', 'info', 'support', 'sales', 'contact', 'help', 'billing',
    'noreply', 'no-reply', 'postmaster', 'webmaster', 'abuse', 'security',
    'office', 'team', 'hr', 'marketing', 'press', 'media',
  ])
  const isRoleBased = ROLE_PREFIXES.has(localPart)

  return {
    email,
    localPart,
    domain,
    validation: {
      formatValid: true,
      domainExists: hasValidDomain,
      hasMxRecords: mx.length > 0,
      isDeliverable: hasValidDomain && mx.length > 0,
    },
    classification: {
      provider,
      isFreeMail,
      isDisposable,
      isRoleBased,
    },
    mx: mx.slice(0, 5),
  }
}, { method: 'enrich_email' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { enrichDomain, enrichIp, enrichEmail }

console.log('settlegrid-data-enrichment MCP server ready')
console.log('Methods: enrich_domain, enrich_ip, enrich_email')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
