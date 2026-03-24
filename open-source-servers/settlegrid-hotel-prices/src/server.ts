/**
 * settlegrid-hotel-prices — Hotel Pricing MCP Server
 *
 * Provides hotel pricing comparison data via the Makcorps Hotel API.
 * Free tier available.
 *
 * Methods:
 *   search_hotels(city, checkin, checkout)  (2¢)
 *   get_hotel_details(hotel_id)             (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchHotelsInput {
  city: string
  checkin?: string
  checkout?: string
}

interface GetHotelDetailsInput {
  hotel_id: string
}

const API_BASE = 'https://api.makcorps.com'
const USER_AGENT = 'settlegrid-hotel-prices/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const apiKey = process.env.MAKCORPS_API_KEY || ''
  if (apiKey) url.searchParams.set('api_key', apiKey)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Makcorps API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'hotel-prices',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_hotels: { costCents: 2, displayName: 'Search hotel prices by city' },
      get_hotel_details: { costCents: 1, displayName: 'Get hotel details' },
    },
  },
})

const searchHotels = sg.wrap(async (args: SearchHotelsInput) => {
  if (!args.city || typeof args.city !== 'string') {
    throw new Error('city is required')
  }
  const params: Record<string, string> = { city: args.city }
  if (args.checkin) params.checkin = args.checkin
  if (args.checkout) params.checkout = args.checkout
  const data = await apiFetch<Record<string, unknown>>('/city', params)
  return { city: args.city, ...data }
}, { method: 'search_hotels' })

const getHotelDetails = sg.wrap(async (args: GetHotelDetailsInput) => {
  if (!args.hotel_id || typeof args.hotel_id !== 'string') {
    throw new Error('hotel_id is required')
  }
  const data = await apiFetch<Record<string, unknown>>(`/hotel/${encodeURIComponent(args.hotel_id)}`)
  return { hotel_id: args.hotel_id, ...data }
}, { method: 'get_hotel_details' })

export { searchHotels, getHotelDetails }

console.log('settlegrid-hotel-prices MCP server ready')
console.log('Methods: search_hotels, get_hotel_details')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
