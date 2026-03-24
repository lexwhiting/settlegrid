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

interface GetStylesInput {}

// ─── Helpers ────────────────────────────────────────────────────────────────

const DICEBEAR_BASE = 'https://api.dicebear.com/7.x'

const AVAILABLE_STYLES = [
  'adventurer', 'adventurer-neutral', 'avataaars', 'avataaars-neutral',
  'big-ears', 'big-ears-neutral', 'big-smile', 'bottts', 'bottts-neutral',
  'croodles', 'croodles-neutral', 'dylan', 'fun-emoji', 'glass',
  'icons', 'identicon', 'initials', 'lorelei', 'lorelei-neutral',
  'micah', 'miniavs', 'notionists', 'notionists-neutral',
  'open-peeps', 'personas', 'pixel-art', 'pixel-art-neutral',
  'rings', 'shapes', 'thumbs',
]

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
  const style = typeof args.style === 'string' && AVAILABLE_STYLES.includes(args.style.trim())
    ? args.style.trim()
    : 'identicon'
  const url = `${DICEBEAR_BASE}/${style}/svg?seed=${encodeURIComponent(seed)}`
  return { url, seed, style, format: 'svg' }
}, { method: 'generate' })

const getStyles = sg.wrap(async (_args: GetStylesInput) => {
  return { styles: AVAILABLE_STYLES, count: AVAILABLE_STYLES.length }
}, { method: 'get_styles' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { generate, getStyles }

console.log('settlegrid-avatar MCP server ready')
console.log('Methods: generate, get_styles')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
