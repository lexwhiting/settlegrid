/**
 * settlegrid-color — Color Converter MCP Server
 *
 * Convert colors between hex, RGB, and HSL formats.
 *
 * Methods:
 *   convert(color, format)        — Convert a color between hex, RGB, and HSL  (1¢)
 *   random_color()                — Generate a random color  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'
import { randomInt } from 'node:crypto'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConvertInput {
  color: string
  format?: string
}

interface RandomColorInput {}

interface ColorResult {
  hex: string
  rgb: { r: number; g: number; b: number }
  hsl: { h: number; s: number; l: number }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, '')
  const full = h.length === 3 ? h[0]+h[0]+h[1]+h[1]+h[2]+h[2] : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

function parseRgb(str: string): [number, number, number] {
  const m = str.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!m) throw new Error('Invalid RGB format. Use "r,g,b" (e.g. "255,128,0")')
  return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, Math.round(l * 100)]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function toColorResult(r: number, g: number, b: number): ColorResult {
  const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
  const [h, s, l] = rgbToHsl(r, g, b)
  return { hex, rgb: { r, g, b }, hsl: { h, s, l } }
}

function parseColor(color: string): ColorResult {
  const c = color.trim()
  if (c.startsWith('#') || /^[0-9a-fA-F]{3,6}$/.test(c)) {
    const [r, g, b] = parseHex(c)
    return toColorResult(r, g, b)
  }
  if (c.includes(',')) {
    const [r, g, b] = parseRgb(c)
    return toColorResult(r, g, b)
  }
  throw new Error('Unsupported color format. Use hex (#ff0000) or RGB (255,0,0)')
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'color',
  pricing: {
    defaultCostCents: 1,
    methods: {
      convert: { costCents: 1, displayName: 'Convert Color' },
      random_color: { costCents: 1, displayName: 'Random Color' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const convert = sg.wrap(async (args: ConvertInput) => {
  if (!args.color || typeof args.color !== 'string') throw new Error('color is required')
  return parseColor(args.color)
}, { method: 'convert' })

const randomColor = sg.wrap(async (_args: RandomColorInput) => {
  return toColorResult(randomInt(256), randomInt(256), randomInt(256))
}, { method: 'random_color' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { convert, randomColor }

console.log('settlegrid-color MCP server ready')
console.log('Methods: convert, random_color')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
