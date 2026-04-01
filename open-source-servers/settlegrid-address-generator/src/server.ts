/**
 * settlegrid-address-generator — Realistic Address Generation MCP Server
 *
 * Generates realistic test addresses, coordinates, and postal codes.
 * All data is locally generated — no external API needed.
 *
 * Methods:
 *   generate_address(country?, count?)          — Generate realistic addresses     (1¢)
 *   generate_coordinates(bounds?, count?)       — Generate random GPS coordinates  (1¢)
 *   generate_postal_code(country?, count?)      — Generate valid postal codes      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GenerateAddressInput {
  country?: string
  count?: number
}

interface GenerateCoordinatesInput {
  bounds?: { lat_min: number; lat_max: number; lon_min: number; lon_max: number }
  count?: number
}

interface GeneratePostalCodeInput {
  country?: string
  count?: number
}

interface CityEntry {
  city: string
  state: string
  zip: string
}

// ─── Data ───────────────────────────────────────────────────────────────────

const STREETS = [
  'Main St', 'Oak Ave', 'Elm St', 'Park Blvd', 'Cedar Ln', 'Maple Dr',
  'Pine St', 'Washington Ave', 'Lake Rd', 'River Rd', 'Broadway',
  'Highland Ave', 'Sunset Blvd', 'Market St', 'College Ave', 'Spring St',
  'Church St', 'Mill Rd', 'Center St', 'Union Ave', 'Walnut St',
  'Chestnut St', 'Franklin Ave', 'Liberty St', 'Prospect Ave',
]

const CITIES: Record<string, CityEntry[]> = {
  US: [
    { city: 'New York', state: 'NY', zip: '10001' },
    { city: 'Los Angeles', state: 'CA', zip: '90012' },
    { city: 'Chicago', state: 'IL', zip: '60601' },
    { city: 'Houston', state: 'TX', zip: '77002' },
    { city: 'Phoenix', state: 'AZ', zip: '85004' },
    { city: 'Denver', state: 'CO', zip: '80202' },
    { city: 'Seattle', state: 'WA', zip: '98101' },
    { city: 'Boston', state: 'MA', zip: '02110' },
    { city: 'Miami', state: 'FL', zip: '33101' },
    { city: 'Portland', state: 'OR', zip: '97201' },
    { city: 'Austin', state: 'TX', zip: '78701' },
    { city: 'Nashville', state: 'TN', zip: '37201' },
  ],
  GB: [
    { city: 'London', state: 'England', zip: 'SW1A 1AA' },
    { city: 'Manchester', state: 'England', zip: 'M1 1AE' },
    { city: 'Birmingham', state: 'England', zip: 'B1 1BB' },
    { city: 'Edinburgh', state: 'Scotland', zip: 'EH1 1YZ' },
    { city: 'Cardiff', state: 'Wales', zip: 'CF10 1EP' },
  ],
  CA: [
    { city: 'Toronto', state: 'ON', zip: 'M5H 2N2' },
    { city: 'Vancouver', state: 'BC', zip: 'V6B 3K9' },
    { city: 'Montreal', state: 'QC', zip: 'H2X 1Y4' },
    { city: 'Calgary', state: 'AB', zip: 'T2P 1J9' },
    { city: 'Ottawa', state: 'ON', zip: 'K1P 5G3' },
  ],
  AU: [
    { city: 'Sydney', state: 'NSW', zip: '2000' },
    { city: 'Melbourne', state: 'VIC', zip: '3000' },
    { city: 'Brisbane', state: 'QLD', zip: '4000' },
    { city: 'Perth', state: 'WA', zip: '6000' },
  ],
}

const COUNTRY_BOUNDS: Record<string, { lat_min: number; lat_max: number; lon_min: number; lon_max: number }> = {
  US: { lat_min: 25, lat_max: 48, lon_min: -125, lon_max: -67 },
  GB: { lat_min: 49.9, lat_max: 58.7, lon_min: -8.2, lon_max: 1.8 },
  CA: { lat_min: 42, lat_max: 60, lon_min: -141, lon_max: -52 },
  AU: { lat_min: -44, lat_max: -10, lon_min: 113, lon_max: 154 },
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'address-generator',
  pricing: {
    defaultCostCents: 1,
    methods: {
      generate_address: { costCents: 1, displayName: 'Generate Address' },
      generate_coordinates: { costCents: 1, displayName: 'Generate Coordinates' },
      generate_postal_code: { costCents: 1, displayName: 'Generate Postal Code' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const generateAddress = sg.wrap(async (args: GenerateAddressInput) => {
  const count = Math.min(Math.max(args.count ?? 1, 1), 20)
  const country = (args.country ?? 'US').toUpperCase()
  const cityList = CITIES[country] ?? CITIES['US']

  const addresses = Array.from({ length: count }, () => {
    const num = Math.floor(Math.random() * 9999) + 1
    const street = pick(STREETS)
    const c = pick(cityList)
    const apt = Math.random() > 0.7 ? `, Apt ${Math.floor(Math.random() * 300) + 1}` : ''
    return {
      street: `${num} ${street}${apt}`,
      city: c.city,
      state: c.state,
      postalCode: c.zip,
      country,
      full: `${num} ${street}${apt}, ${c.city}, ${c.state} ${c.zip}`,
    }
  })

  return {
    count,
    country,
    addresses,
    note: 'Generated for testing purposes only — not real addresses',
  }
}, { method: 'generate_address' })

const generateCoordinates = sg.wrap(async (args: GenerateCoordinatesInput) => {
  const count = Math.min(Math.max(args.count ?? 1, 1), 50)
  const bounds = args.bounds ?? COUNTRY_BOUNDS['US']

  const coordinates = Array.from({ length: count }, () => ({
    latitude: Math.round((bounds.lat_min + Math.random() * (bounds.lat_max - bounds.lat_min)) * 100000) / 100000,
    longitude: Math.round((bounds.lon_min + Math.random() * (bounds.lon_max - bounds.lon_min)) * 100000) / 100000,
  }))

  return { count, bounds, coordinates }
}, { method: 'generate_coordinates' })

const generatePostalCode = sg.wrap(async (args: GeneratePostalCodeInput) => {
  const count = Math.min(Math.max(args.count ?? 1, 1), 20)
  const country = (args.country ?? 'US').toUpperCase()
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  const generators: Record<string, () => string> = {
    US: () => String(Math.floor(Math.random() * 90000) + 10000),
    GB: () => {
      const p1 = alpha[Math.floor(Math.random() * 26)]
      const p2 = alpha[Math.floor(Math.random() * 26)]
      const d1 = Math.floor(Math.random() * 10)
      const d2 = Math.floor(Math.random() * 10)
      const s1 = alpha[Math.floor(Math.random() * 26)]
      const s2 = alpha[Math.floor(Math.random() * 26)]
      return `${p1}${p2}${d1} ${d2}${s1}${s2}`
    },
    CA: () => {
      const a1 = alpha[Math.floor(Math.random() * 26)]
      const d1 = Math.floor(Math.random() * 10)
      const a2 = alpha[Math.floor(Math.random() * 26)]
      const d2 = Math.floor(Math.random() * 10)
      const a3 = alpha[Math.floor(Math.random() * 26)]
      const d3 = Math.floor(Math.random() * 10)
      return `${a1}${d1}${a2} ${d2}${a3}${d3}`
    },
    AU: () => String(Math.floor(Math.random() * 8000) + 200),
    DE: () => String(Math.floor(Math.random() * 90000) + 10000),
    JP: () => `${String(Math.floor(Math.random() * 900) + 100)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
  }

  const gen = generators[country] ?? generators['US']
  const codes = Array.from({ length: count }, () => gen())

  return { count, country, postalCodes: codes }
}, { method: 'generate_postal_code' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { generateAddress, generateCoordinates, generatePostalCode }

console.log('settlegrid-address-generator MCP server ready')
console.log('Methods: generate_address, generate_coordinates, generate_postal_code')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
