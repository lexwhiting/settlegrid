/**
 * settlegrid-placeholder — Placeholder Images MCP Server
 *
 * Generate placeholder images via placehold.co.
 *
 * Methods:
 *   get_image(width, height, text, bg, color) — Get a placeholder image URL  (1¢)
 *   get_svg(width, height, text)  — Get a placeholder SVG URL  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetImageInput {
  width: number
  height: number
  text?: string
  bg?: string
  color?: string
}

interface GetSvgInput {
  width: number
  height: number
  text?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://placehold.co'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-placeholder/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Placeholder Images API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'placeholder',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_image: { costCents: 1, displayName: 'Get Image' },
      get_svg: { costCents: 1, displayName: 'Get SVG' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getImage = sg.wrap(async (args: GetImageInput) => {
  if (typeof args.width !== 'number') throw new Error('width is required and must be a number')
  const width = args.width
  if (typeof args.height !== 'number') throw new Error('height is required and must be a number')
  const height = args.height
  const text = typeof args.text === 'string' ? args.text.trim() : ''
  const bg = typeof args.bg === 'string' ? args.bg.trim() : ''
  const color = typeof args.color === 'string' ? args.color.trim() : ''
  const data = await apiFetch<any>(`/${width}x${height}/${encodeURIComponent(bg)}/${encodeURIComponent(color)}?text=${encodeURIComponent(text)}`)
  return {
    url: data.url,
    width: data.width,
    height: data.height,
  }
}, { method: 'get_image' })

const getSvg = sg.wrap(async (args: GetSvgInput) => {
  if (typeof args.width !== 'number') throw new Error('width is required and must be a number')
  const width = args.width
  if (typeof args.height !== 'number') throw new Error('height is required and must be a number')
  const height = args.height
  const text = typeof args.text === 'string' ? args.text.trim() : ''
  const data = await apiFetch<any>(`/${width}x${height}.svg?text=${encodeURIComponent(text)}`)
  return {
    url: data.url,
    width: data.width,
    height: data.height,
  }
}, { method: 'get_svg' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getImage, getSvg }

console.log('settlegrid-placeholder MCP server ready')
console.log('Methods: get_image, get_svg')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
