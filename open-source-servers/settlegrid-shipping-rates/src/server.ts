/**
 * settlegrid-shipping-rates — Shipping Rate Comparison MCP Server
 *
 * Methods:
 *   get_rates(from_zip, to_zip, weight_oz)  (2¢)
 *   validate_address(street, city, state, zip) (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetRatesInput { from_zip: string; to_zip: string; weight_oz: number; length?: number; width?: number; height?: number }
interface ValidateAddressInput { street: string; city: string; state: string; zip: string; country?: string }

const API_BASE = 'https://api.easypost.com/v2'
const USER_AGENT = 'settlegrid-shipping-rates/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, body: unknown): Promise<T> {
  const key = process.env.EASYPOST_API_KEY || ''
  if (!key) throw new Error('EASYPOST_API_KEY is required')
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(key + ':').toString('base64')}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`EasyPost API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'shipping-rates',
  pricing: { defaultCostCents: 1, methods: {
    get_rates: { costCents: 2, displayName: 'Get shipping rates' },
    validate_address: { costCents: 1, displayName: 'Validate address' },
  }},
})

const getRates = sg.wrap(async (args: GetRatesInput) => {
  if (!args.from_zip || !args.to_zip || !args.weight_oz) throw new Error('from_zip, to_zip, and weight_oz are required')
  const data = await apiFetch<Record<string, unknown>>('/shipments', {
    shipment: {
      from_address: { zip: args.from_zip, country: 'US' },
      to_address: { zip: args.to_zip, country: 'US' },
      parcel: {
        weight: args.weight_oz,
        length: args.length || 10,
        width: args.width || 7,
        height: args.height || 5,
      },
    },
  })
  return data
}, { method: 'get_rates' })

const validateAddress = sg.wrap(async (args: ValidateAddressInput) => {
  if (!args.street || !args.city || !args.state || !args.zip) throw new Error('street, city, state, and zip are required')
  const data = await apiFetch<Record<string, unknown>>('/addresses', {
    address: {
      street1: args.street,
      city: args.city,
      state: args.state,
      zip: args.zip,
      country: args.country || 'US',
      verify: ['delivery'],
    },
  })
  return data
}, { method: 'validate_address' })

export { getRates, validateAddress }

console.log('settlegrid-shipping-rates MCP server ready')
console.log('Methods: get_rates, validate_address')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
