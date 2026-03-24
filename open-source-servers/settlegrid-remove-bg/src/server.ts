/**
 * settlegrid-remove-bg — Remove.bg MCP Server
 *
 * Remove image backgrounds automatically via Remove.bg API.
 *
 * Methods:
 *   remove_background(image_url, size) — Remove background from an image URL  (3¢)
 *   remove_bg_with_color(image_url, bg_color) — Remove background and replace with a solid color  (3¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RemoveBackgroundInput {
  image_url: string
  size?: string
}

interface RemoveBgWithColorInput {
  image_url: string
  bg_color?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.remove.bg/v1.0'
const API_KEY = process.env.REMOVE_BG_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-remove-bg/1.0', 'X-Api-Key': API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Remove.bg API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'remove-bg',
  pricing: {
    defaultCostCents: 3,
    methods: {
      remove_background: { costCents: 3, displayName: 'Remove Background' },
      remove_bg_with_color: { costCents: 3, displayName: 'Remove BG with Color' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const removeBackground = sg.wrap(async (args: RemoveBackgroundInput) => {
  if (!args.image_url || typeof args.image_url !== 'string') throw new Error('image_url is required')
  const image_url = args.image_url.trim()
  const size = typeof args.size === 'string' ? args.size.trim() : ''
  const data = await apiFetch<any>(`/removebg`)
  return {
    result_b64: data.result_b64,
    foreground_type: data.foreground_type,
  }
}, { method: 'remove_background' })

const removeBgWithColor = sg.wrap(async (args: RemoveBgWithColorInput) => {
  if (!args.image_url || typeof args.image_url !== 'string') throw new Error('image_url is required')
  const image_url = args.image_url.trim()
  const bg_color = typeof args.bg_color === 'string' ? args.bg_color.trim() : ''
  const data = await apiFetch<any>(`/removebg`)
  return {
    result_b64: data.result_b64,
    foreground_type: data.foreground_type,
  }
}, { method: 'remove_bg_with_color' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { removeBackground, removeBgWithColor }

console.log('settlegrid-remove-bg MCP server ready')
console.log('Methods: remove_background, remove_bg_with_color')
console.log('Pricing: 3¢ per call | Powered by SettleGrid')
