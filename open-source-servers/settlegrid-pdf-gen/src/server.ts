/**
 * settlegrid-pdf-gen — PDF Generator MCP Server
 *
 * Generate PDFs from HTML or URLs via html2pdf.app.
 *
 * Methods:
 *   from_url(url)                 — Generate PDF from a URL  (1¢)
 *   from_html(html)               — Generate PDF from HTML string  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FromUrlInput {
  url: string
}

interface FromHtmlInput {
  html: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.html2pdf.app/v1/generate'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-pdf-gen/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PDF Generator API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'pdf-gen',
  pricing: {
    defaultCostCents: 1,
    methods: {
      from_url: { costCents: 1, displayName: 'From URL' },
      from_html: { costCents: 1, displayName: 'From HTML' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const fromUrl = sg.wrap(async (args: FromUrlInput) => {
  if (!args.url || typeof args.url !== 'string') throw new Error('url is required')
  const url = args.url.trim()
  const data = await apiFetch<any>(`?url=${encodeURIComponent(url)}&apiKey=free`)
  return {
    pdfUrl: data.pdfUrl,
  }
}, { method: 'from_url' })

const fromHtml = sg.wrap(async (args: FromHtmlInput) => {
  if (!args.html || typeof args.html !== 'string') throw new Error('html is required')
  const html = args.html.trim()
  const data = await apiFetch<any>(`?html=${encodeURIComponent(html)}&apiKey=free`)
  return {
    pdfUrl: data.pdfUrl,
  }
}, { method: 'from_html' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { fromUrl, fromHtml }

console.log('settlegrid-pdf-gen MCP server ready')
console.log('Methods: from_url, from_html')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
