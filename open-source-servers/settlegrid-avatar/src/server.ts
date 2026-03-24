/**
 * settlegrid-avatar — DiceBear Avatars MCP Server
 *
 * Generate avatar images via the DiceBear API.
 *
 * Methods:
 *   generate(seed, style)         — Generate an avatar by seed and style  (1¢)
 *   get_styles()                  — List available avatar styles  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GenerateInput {
  seed: string
  style?: string
}

interface GetStylesInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.dicebear.com/7.x'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-avatar/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`DiceBear Avatars API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'avatar',
  pricing: {
    defaultCostCents: 1,
    methods: {
      generate: { costCents: 1, displayName: 'Generate Avatar' },
      get_styles: { costCents: 1, displayName: 'Get Styles' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const generate = sg.wrap(async (args: GenerateInput) => {
  if (!args.seed || typeof args.seed !== 'string') throw new Error('seed is required')
  const seed = args.seed.trim()
  const style = typeof args.style === 'string' ? args.style.trim() : ''
  const data = await apiFetch<any>(`/${encodeURIComponent(style)}/svg?seed=${encodeURIComponent(seed)}`)
  return {
    url: data.url,
    seed: data.seed,
    style: data.style,
  }
}, { method: 'generate' })

const getStyles = sg.wrap(async (args: GetStylesInput) => {

  const data = await apiFetch<any>(`/__local__/get_styles`)
  return {
    styles: data.styles,
  }
}, { method: 'get_styles' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { generate, getStyles }

console.log('settlegrid-avatar MCP server ready')
console.log('Methods: generate, get_styles')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
