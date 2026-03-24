/**
 * settlegrid-placeholder-images — Placeholder Images MCP Server
 *
 * Generates placeholder image URLs with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_placeholder(width, height?, text?, bg_color?, text_color?) — placeholder URL (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface PlaceholderInput { width: number; height?: number; text?: string; bg_color?: string; text_color?: string }

const sg = settlegrid.init({
  toolSlug: 'placeholder-images',
  pricing: { defaultCostCents: 1, methods: { get_placeholder: { costCents: 1, displayName: 'Get Placeholder' } } },
})

const getPlaceholder = sg.wrap(async (args: PlaceholderInput) => {
  if (!args.width || args.width < 1) throw new Error('width is required and must be positive')
  const h = args.height ?? args.width
  const bg = args.bg_color || 'cccccc'
  const tc = args.text_color || '969696'
  let url = `https://via.placeholder.com/${args.width}x${h}/${bg}/${tc}`
  if (args.text) url += `?text=${encodeURIComponent(args.text)}`
  return {
    url, png_url: `${url}.png`, jpg_url: `${url}.jpg`, webp_url: `${url}.webp`,
    width: args.width, height: h, bg_color: bg, text_color: tc,
  }
}, { method: 'get_placeholder' })

export { getPlaceholder }

console.log('settlegrid-placeholder-images MCP server ready')
console.log('Methods: get_placeholder')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
