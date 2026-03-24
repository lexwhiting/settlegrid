/**
 * settlegrid-carbon-sh — Carbonara Code Screenshots MCP Server
 *
 * Generate beautiful code screenshots via Carbonara (Carbon.sh alternative).
 *
 * Methods:
 *   create_screenshot(code, language, theme) — Generate a code screenshot image (returns PNG URL)  (1¢)
 *   create_styled(code, language, backgroundColor) — Generate a styled code screenshot with custom background  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CreateScreenshotInput {
  code: string
  language?: string
  theme?: string
}

interface CreateStyledInput {
  code: string
  language?: string
  backgroundColor?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://carbonara.solopov.dev'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-carbon-sh/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Carbonara Code Screenshots API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'carbon-sh',
  pricing: {
    defaultCostCents: 1,
    methods: {
      create_screenshot: { costCents: 1, displayName: 'Create Screenshot' },
      create_styled: { costCents: 1, displayName: 'Create Styled' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const createScreenshot = sg.wrap(async (args: CreateScreenshotInput) => {
  if (!args.code || typeof args.code !== 'string') throw new Error('code is required')
  const code = args.code.trim()
  const language = typeof args.language === 'string' ? args.language.trim() : ''
  const theme = typeof args.theme === 'string' ? args.theme.trim() : ''
  const data = await apiFetch<any>(`/api/cook`)
  return {
    url: data.url,
  }
}, { method: 'create_screenshot' })

const createStyled = sg.wrap(async (args: CreateStyledInput) => {
  if (!args.code || typeof args.code !== 'string') throw new Error('code is required')
  const code = args.code.trim()
  const language = typeof args.language === 'string' ? args.language.trim() : ''
  const backgroundColor = typeof args.backgroundColor === 'string' ? args.backgroundColor.trim() : ''
  const data = await apiFetch<any>(`/api/cook`)
  return {
    url: data.url,
  }
}, { method: 'create_styled' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { createScreenshot, createStyled }

console.log('settlegrid-carbon-sh MCP server ready')
console.log('Methods: create_screenshot, create_styled')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
