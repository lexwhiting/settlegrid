/**
 * settlegrid-walk-score — Walk Score MCP Server
 *
 * Walkability, transit, and bike scores for any address.
 *
 * Methods:
 *   get_score(address, lat, lon)  — Get walk, transit, and bike scores for an address  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetScoreInput {
  address: string
  lat: number
  lon: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.walkscore.com'
const API_KEY = process.env.WALKSCORE_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-walk-score/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Walk Score API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'walk-score',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_score: { costCents: 2, displayName: 'Get Walk Score' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScore = sg.wrap(async (args: GetScoreInput) => {
  if (!args.address || typeof args.address !== 'string') throw new Error('address is required')
  const address = args.address.trim()
  if (typeof args.lat !== 'number') throw new Error('lat is required and must be a number')
  const lat = args.lat
  if (typeof args.lon !== 'number') throw new Error('lon is required and must be a number')
  const lon = args.lon
  const data = await apiFetch<any>(`/score?format=json&transit=1&bike=1&address=${encodeURIComponent(address)}&lat=${lat}&lon=${lon}&wsapikey=${API_KEY}`)
  return {
    walkscore: data.walkscore,
    description: data.description,
    transit: data.transit,
    bike: data.bike,
  }
}, { method: 'get_score' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScore }

console.log('settlegrid-walk-score MCP server ready')
console.log('Methods: get_score')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
