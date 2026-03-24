/**
 * settlegrid-security-headers — Security Headers MCP Server
 *
 * Analyze HTTP security headers of any website.
 *
 * Methods:
 *   scan_headers(url)             — Analyze security headers of a URL  (1¢)
 *   check_csp(url)                — Check Content-Security-Policy header of a URL  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScanHeadersInput {
  url: string
}

interface CheckCspInput {
  url: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://securityheaders.com'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-security-headers/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Security Headers API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'security-headers',
  pricing: {
    defaultCostCents: 1,
    methods: {
      scan_headers: { costCents: 1, displayName: 'Scan Headers' },
      check_csp: { costCents: 1, displayName: 'Check CSP' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const scanHeaders = sg.wrap(async (args: ScanHeadersInput) => {
  if (!args.url || typeof args.url !== 'string') throw new Error('url is required')
  const url = args.url.trim()
  const data = await apiFetch<any>(`/?q=${encodeURIComponent(url)}&followRedirects=on&hide=on`)
  return {
    grade: data.grade,
    headers: data.headers,
    missing: data.missing,
  }
}, { method: 'scan_headers' })

const checkCsp = sg.wrap(async (args: CheckCspInput) => {
  if (!args.url || typeof args.url !== 'string') throw new Error('url is required')
  const url = args.url.trim()
  const data = await apiFetch<any>(`/?q=${encodeURIComponent(url)}&followRedirects=on&hide=on`)
  return {
    grade: data.grade,
    headers: data.headers,
  }
}, { method: 'check_csp' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { scanHeaders, checkCsp }

console.log('settlegrid-security-headers MCP server ready')
console.log('Methods: scan_headers, check_csp')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
