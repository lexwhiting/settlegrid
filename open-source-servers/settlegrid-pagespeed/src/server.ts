/**
 * settlegrid-pagespeed — Google PageSpeed Insights MCP Server
 *
 * Website performance analysis via Google PageSpeed Insights.
 *
 * Methods:
 *   analyze_url(url)              — Run PageSpeed analysis on a URL (mobile)  (2¢)
 *   analyze_desktop(url)          — Run PageSpeed analysis on a URL (desktop)  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface AnalyzeUrlInput {
  url: string
}

interface AnalyzeDesktopInput {
  url: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.googleapis.com/pagespeedonline/v5'
const API_KEY = process.env.GOOGLE_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-pagespeed/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Google PageSpeed Insights API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'pagespeed',
  pricing: {
    defaultCostCents: 2,
    methods: {
      analyze_url: { costCents: 2, displayName: 'Analyze URL' },
      analyze_desktop: { costCents: 2, displayName: 'Analyze Desktop' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const analyzeUrl = sg.wrap(async (args: AnalyzeUrlInput) => {
  if (!args.url || typeof args.url !== 'string') throw new Error('url is required')
  const url = args.url.trim()
  const data = await apiFetch<any>(`/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&category=accessibility&category=seo&key=${API_KEY}`)
  return {
    id: data.id,
    lighthouseResult: data.lighthouseResult,
  }
}, { method: 'analyze_url' })

const analyzeDesktop = sg.wrap(async (args: AnalyzeDesktopInput) => {
  if (!args.url || typeof args.url !== 'string') throw new Error('url is required')
  const url = args.url.trim()
  const data = await apiFetch<any>(`/runPagespeed?url=${encodeURIComponent(url)}&strategy=desktop&category=performance&category=accessibility&category=seo&key=${API_KEY}`)
  return {
    id: data.id,
    lighthouseResult: data.lighthouseResult,
  }
}, { method: 'analyze_desktop' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { analyzeUrl, analyzeDesktop }

console.log('settlegrid-pagespeed MCP server ready')
console.log('Methods: analyze_url, analyze_desktop')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
