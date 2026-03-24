/**
 * settlegrid-abstract-api — Abstract API MCP Server
 *
 * Wraps Abstract API for company/email/IP data with SettleGrid billing.
 * Requires an Abstract API key (free tier available).
 *
 * Methods:
 *   enrich_company(domain)  — Company enrichment    (2¢)
 *   validate_email(email)   — Email validation      (2¢)
 *   geolocate_ip(ip)        — IP geolocation        (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DomainInput { domain: string }
interface EmailInput { email: string }
interface IpInput { ip: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_KEY = process.env.ABSTRACT_API_KEY || ''
const DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const IP_RE = /^[\d.:a-fA-F]+$/

async function abstractFetch<T>(baseUrl: string, params: string): Promise<T> {
  if (!API_KEY) throw new Error('ABSTRACT_API_KEY environment variable is required')
  const res = await fetch(`${baseUrl}?api_key=${API_KEY}&${params}`)
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid Abstract API key')
    const body = await res.text().catch(() => '')
    throw new Error(`Abstract API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'abstract-api',
  pricing: {
    defaultCostCents: 2,
    methods: {
      enrich_company: { costCents: 2, displayName: 'Enrich Company' },
      validate_email: { costCents: 2, displayName: 'Validate Email' },
      geolocate_ip: { costCents: 2, displayName: 'Geolocate IP' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const enrichCompany = sg.wrap(async (args: DomainInput) => {
  if (!args.domain || typeof args.domain !== 'string') throw new Error('domain is required')
  const domain = args.domain.trim().toLowerCase()
  if (!DOMAIN_RE.test(domain)) throw new Error('Invalid domain format')
  const data = await abstractFetch<Record<string, unknown>>('https://companyenrichment.abstractapi.com/v1', `domain=${domain}`)
  return { domain, name: data.name, country: data.country, industry: data.industry, employees: data.employees_count, founded: data.year_founded, type: data.type, linkedin: data.linkedin_url || null }
}, { method: 'enrich_company' })

const validateEmail = sg.wrap(async (args: EmailInput) => {
  if (!args.email || typeof args.email !== 'string') throw new Error('email is required')
  const email = args.email.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) throw new Error('Invalid email format')
  const data = await abstractFetch<Record<string, unknown>>('https://emailvalidation.abstractapi.com/v1', `email=${encodeURIComponent(email)}`)
  return { email, deliverability: data.deliverability, qualityScore: data.quality_score, isValidFormat: data.is_valid_format, isFreeEmail: data.is_free_email, isDisposable: data.is_disposable_email, isMxFound: data.is_mx_found, isSmtpValid: data.is_smtp_valid }
}, { method: 'validate_email' })

const geolocateIp = sg.wrap(async (args: IpInput) => {
  if (!args.ip || typeof args.ip !== 'string') throw new Error('ip is required')
  const ip = args.ip.trim()
  if (!IP_RE.test(ip)) throw new Error('Invalid IP address format')
  const data = await abstractFetch<Record<string, unknown>>('https://ipgeolocation.abstractapi.com/v1', `ip_address=${ip}`)
  return { ip, city: data.city, region: data.region, country: data.country, countryCode: data.country_code, continent: data.continent, latitude: data.latitude, longitude: data.longitude, timezone: data.timezone, isp: data.connection ? (data.connection as Record<string, unknown>).isp_name : null }
}, { method: 'geolocate_ip' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { enrichCompany, validateEmail, geolocateIp }

console.log('settlegrid-abstract-api MCP server ready')
console.log('Methods: enrich_company, validate_email, geolocate_ip')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
