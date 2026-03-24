/**
 * settlegrid-color-palette — Color Palette MCP Server
 *
 * Wraps TheColorAPI with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_color_info(hex) — color info (1¢)
 *   get_color_scheme(hex, mode?, count?) — color scheme (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ColorInput { hex: string }
interface SchemeInput { hex: string; mode?: string; count?: number }

const API_BASE = 'https://www.thecolorapi.com'

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'color-palette',
  pricing: { defaultCostCents: 1, methods: { get_color_info: { costCents: 1, displayName: 'Color Info' }, get_color_scheme: { costCents: 1, displayName: 'Color Scheme' } } },
})

const getColorInfo = sg.wrap(async (args: ColorInput) => {
  if (!args.hex) throw new Error('hex is required')
  const hex = args.hex.replace('#', '')
  const data = await apiFetch<any>(`/id?hex=${hex}`)
  return {
    hex: data.hex?.value, rgb: data.rgb?.value, hsl: data.hsl?.value,
    name: data.name?.value, exact_match: data.name?.exact_match_named_color,
    closest_named: data.name?.closest_named_hex,
    cmyk: data.cmyk?.value, hsv: data.hsv?.value,
  }
}, { method: 'get_color_info' })

const getColorScheme = sg.wrap(async (args: SchemeInput) => {
  if (!args.hex) throw new Error('hex is required')
  const hex = args.hex.replace('#', '')
  const mode = args.mode || 'complement'
  const count = args.count ?? 5
  const data = await apiFetch<any>(`/scheme?hex=${hex}&mode=${mode}&count=${count}`)
  return {
    mode, seed: data.seed?.hex?.value,
    colors: (data.colors || []).map((c: any) => ({
      hex: c.hex?.value, rgb: c.rgb?.value, name: c.name?.value,
    })),
  }
}, { method: 'get_color_scheme' })

export { getColorInfo, getColorScheme }

console.log('settlegrid-color-palette MCP server ready')
console.log('Methods: get_color_info, get_color_scheme')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
