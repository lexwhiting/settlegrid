/**
 * settlegrid-country-flag-api — Country Flags API MCP Server
 *
 * Provides country flag URLs with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_flag_url(country_code, size?) — flag URL (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface FlagInput { country_code: string; size?: number }

const sg = settlegrid.init({
  toolSlug: 'country-flag-api',
  pricing: { defaultCostCents: 1, methods: { get_flag_url: { costCents: 1, displayName: 'Get Flag URL' } } },
})

const getFlagUrl = sg.wrap(async (args: FlagInput) => {
  if (!args.country_code) throw new Error('country_code is required')
  const code = args.country_code.toLowerCase()
  const size = args.size ?? 256
  const codePoints = code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  const emoji = String.fromCodePoint(...codePoints)
  return {
    country_code: code.toUpperCase(),
    flag_png: `https://flagcdn.com/w${size}/${code}.png`,
    flag_svg: `https://flagcdn.com/${code}.svg`,
    flag_emoji: emoji,
    sizes_available: [20, 40, 80, 160, 256, 320, 640, 1280, 2560],
  }
}, { method: 'get_flag_url' })

export { getFlagUrl }

console.log('settlegrid-country-flag-api MCP server ready')
console.log('Methods: get_flag_url')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
