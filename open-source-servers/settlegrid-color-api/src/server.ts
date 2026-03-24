/**
 * settlegrid-color-api — Color Palettes MCP Server
 *
 * Wraps The Color API with SettleGrid billing.
 * No API key needed — completely free and open.
 *
 * Methods:
 *   get_color(hex)                    — Get color details (1¢)
 *   get_scheme(hex, mode?, count?)    — Generate scheme (1¢)
 *   get_random()                      — Random color (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetColorInput {
  hex: string
}

interface GetSchemeInput {
  hex: string
  mode?: string
  count?: number
}

interface ColorValue {
  hex: { value: string; clean: string }
  rgb: { r: number; g: number; b: number; value: string }
  hsl: { h: number; s: number; l: number; value: string }
  hsv: { h: number; s: number; v: number; value: string }
  cmyk: { c: number; m: number; y: number; k: number; value: string }
  name: { value: string; closest_named_hex: string; exact_match_name: boolean }
  contrast: { value: string }
  [key: string]: unknown
}

interface SchemeResult {
  mode: string
  count: number
  colors: ColorValue[]
  seed: ColorValue
  [key: string]: unknown
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.thecolorapi.com'
const USER_AGENT = 'settlegrid-color-api/1.0 (contact@settlegrid.ai)'

function cleanHex(hex: string): string {
  return hex.replace(/^#/, '').replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
}

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Color API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'color-api',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_color: { costCents: 1, displayName: 'Get color details' },
      get_scheme: { costCents: 1, displayName: 'Generate color scheme' },
      get_random: { costCents: 1, displayName: 'Get random color' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getColor = sg.wrap(async (args: GetColorInput) => {
  if (!args.hex || typeof args.hex !== 'string') {
    throw new Error('hex is required (color hex code, e.g. FF5733)')
  }
  const hex = cleanHex(args.hex)
  if (hex.length < 3) throw new Error('Invalid hex color code')
  return apiFetch<ColorValue>('/id', { hex })
}, { method: 'get_color' })

const getScheme = sg.wrap(async (args: GetSchemeInput) => {
  if (!args.hex || typeof args.hex !== 'string') {
    throw new Error('hex is required (base hex color)')
  }
  const hex = cleanHex(args.hex)
  if (hex.length < 3) throw new Error('Invalid hex color code')
  const params: Record<string, string> = { hex }
  if (args.mode) params['mode'] = args.mode
  if (args.count !== undefined) params['count'] = String(args.count)
  return apiFetch<SchemeResult>('/scheme', params)
}, { method: 'get_scheme' })

const getRandom = sg.wrap(async () => {
  const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')
  return apiFetch<ColorValue>('/id', { hex })
}, { method: 'get_random' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getColor, getScheme, getRandom }

console.log('settlegrid-color-api MCP server ready')
console.log('Methods: get_color, get_scheme, get_random')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
