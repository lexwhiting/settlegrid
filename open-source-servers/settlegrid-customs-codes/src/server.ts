/**
 * settlegrid-customs-codes — HS/Tariff Code Lookup MCP Server
 *
 * Methods:
 *   search_hs_code(query)            (1¢)
 *   get_hs_code(code)                (1¢)
 *   get_tariff_rate(code, country)   (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchHsCodeInput { query: string }
interface GetHsCodeInput { code: string }
interface GetTariffRateInput { code: string; country: string }

const API_BASE = 'https://api.worldbank.org/v2'
const USER_AGENT = 'settlegrid-customs-codes/1.0 (contact@settlegrid.ai)'

// HS Chapter reference data
const HS_CHAPTERS: Record<string, string> = {
  '01': 'Live animals', '02': 'Meat and edible meat offal', '03': 'Fish and crustaceans',
  '04': 'Dairy produce', '05': 'Products of animal origin', '06': 'Live trees and plants',
  '07': 'Edible vegetables', '08': 'Edible fruit and nuts', '09': 'Coffee, tea, spices',
  '10': 'Cereals', '11': 'Milling industry products', '12': 'Oil seeds',
  '15': 'Animal or vegetable fats', '16': 'Preparations of meat/fish', '17': 'Sugars',
  '18': 'Cocoa', '20': 'Preparations of vegetables/fruit', '22': 'Beverages',
  '25': 'Salt, sulphur, earths, stone', '27': 'Mineral fuels, oils', '28': 'Inorganic chemicals',
  '29': 'Organic chemicals', '30': 'Pharmaceutical products', '39': 'Plastics',
  '40': 'Rubber', '44': 'Wood', '48': 'Paper and paperboard', '52': 'Cotton',
  '61': 'Knitted apparel', '62': 'Woven apparel', '64': 'Footwear',
  '72': 'Iron and steel', '73': 'Articles of iron/steel', '84': 'Machinery',
  '85': 'Electrical machinery', '87': 'Vehicles', '90': 'Optical/medical instruments',
  '94': 'Furniture', '95': 'Toys and games', '97': 'Works of art',
}

const sg = settlegrid.init({
  toolSlug: 'customs-codes',
  pricing: { defaultCostCents: 1, methods: {
    search_hs_code: { costCents: 1, displayName: 'Search HS codes' },
    get_hs_code: { costCents: 1, displayName: 'Get HS code details' },
    get_tariff_rate: { costCents: 2, displayName: 'Get tariff rate' },
  }},
})

const searchHsCode = sg.wrap(async (args: SearchHsCodeInput) => {
  if (!args.query) throw new Error('query is required (product description)')
  const q = args.query.toLowerCase()
  const results = Object.entries(HS_CHAPTERS)
    .filter(([, desc]) => desc.toLowerCase().includes(q))
    .map(([code, description]) => ({ chapter: code, description, hs_prefix: code }))
  return { query: args.query, count: results.length, results }
}, { method: 'search_hs_code' })

const getHsCode = sg.wrap(async (args: GetHsCodeInput) => {
  if (!args.code) throw new Error('code is required (2-digit HS chapter)')
  const chapter = args.code.slice(0, 2)
  const description = HS_CHAPTERS[chapter] || 'Unknown chapter'
  return { code: args.code, chapter, description }
}, { method: 'get_hs_code' })

const getTariffRate = sg.wrap(async (args: GetTariffRateInput) => {
  if (!args.code || !args.country) throw new Error('code and country are required')
  const res = await fetch(
    `${API_BASE}/country/${encodeURIComponent(args.country.toUpperCase())}/indicator/TM.TAX.MRCH.WM.AR.ZS?date=2020:2024&format=json`,
    { headers: { 'User-Agent': USER_AGENT } }
  )
  if (!res.ok) throw new Error(`World Bank API ${res.status}`)
  const data = await res.json()
  return { code: args.code, country: args.country.toUpperCase(), tariff_data: Array.isArray(data) && data[1] ? data[1] : data }
}, { method: 'get_tariff_rate' })

export { searchHsCode, getHsCode, getTariffRate }

console.log('settlegrid-customs-codes MCP server ready')
console.log('Methods: search_hs_code, get_hs_code, get_tariff_rate')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
