/**
 * settlegrid-markdown — Markdown Renderer MCP Server
 *
 * Convert Markdown to HTML via the GitHub Markdown API.
 *
 * Methods:
 *   render(text)                  — Render Markdown text to HTML  (1¢)
 *   render_raw(text)              — Render raw Markdown to HTML  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RenderInput {
  text: string
}

interface RenderRawInput {
  text: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const GH_BASE = 'https://api.github.com'

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'markdown',
  pricing: {
    defaultCostCents: 1,
    methods: {
      render: { costCents: 1, displayName: 'Render Markdown' },
      render_raw: { costCents: 1, displayName: 'Render Raw' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const render = sg.wrap(async (args: RenderInput) => {
  if (!args.text || typeof args.text !== 'string') throw new Error('text is required')
  const res = await fetch(`${GH_BASE}/markdown`, {
    method: 'POST',
    headers: {
      'User-Agent': 'settlegrid-markdown/1.0',
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({ text: args.text, mode: 'markdown' }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub Markdown API ${res.status}: ${body.slice(0, 200)}`)
  }
  const html = await res.text()
  return { html, length: html.length }
}, { method: 'render' })

const renderRaw = sg.wrap(async (args: RenderRawInput) => {
  if (!args.text || typeof args.text !== 'string') throw new Error('text is required')
  const res = await fetch(`${GH_BASE}/markdown/raw`, {
    method: 'POST',
    headers: {
      'User-Agent': 'settlegrid-markdown/1.0',
      'Content-Type': 'text/plain',
      Accept: 'application/vnd.github+json',
    },
    body: args.text,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub Markdown API ${res.status}: ${body.slice(0, 200)}`)
  }
  const html = await res.text()
  return { html, length: html.length }
}, { method: 'render_raw' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { render, renderRaw }

console.log('settlegrid-markdown MCP server ready')
console.log('Methods: render, render_raw')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
