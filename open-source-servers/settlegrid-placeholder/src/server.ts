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

const PLACEHOLD_BASE = 'https://placehold.co'
const MAX_DIM = 4000

function clampDim(v: number): number {
  return Math.min(Math.max(Math.round(v), 1), MAX_DIM)
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
  if (typeof args.height !== 'number') throw new Error('height is required and must be a number')
  const w = clampDim(args.width)
  const h = clampDim(args.height)
  const bg = typeof args.bg === 'string' ? args.bg.trim().replace(/[^a-fA-F0-9]/g, '') : ''
  const color = typeof args.color === 'string' ? args.color.trim().replace(/[^a-fA-F0-9]/g, '') : ''
  const text = typeof args.text === 'string' ? args.text.trim() : ''
  let url = `${PLACEHOLD_BASE}/${w}x${h}`
  if (bg) url += `/${bg}`
  if (bg && color) url += `/${color}`
  if (text) url += `?text=${encodeURIComponent(text)}`
  return { url, width: w, height: h, format: 'png' }
}, { method: 'get_image' })

const getSvg = sg.wrap(async (args: GetSvgInput) => {
  if (typeof args.width !== 'number') throw new Error('width is required and must be a number')
  if (typeof args.height !== 'number') throw new Error('height is required and must be a number')
  const w = clampDim(args.width)
  const h = clampDim(args.height)
  const text = typeof args.text === 'string' ? args.text.trim() : ''
  let url = `${PLACEHOLD_BASE}/${w}x${h}.svg`
  if (text) url += `?text=${encodeURIComponent(text)}`
  return { url, width: w, height: h, format: 'svg' }
}, { method: 'get_svg' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getImage, getSvg }

console.log('settlegrid-placeholder MCP server ready')
console.log('Methods: get_image, get_svg')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
