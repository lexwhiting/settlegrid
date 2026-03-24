/**
 * settlegrid-tracking — Multi-Carrier Package Tracking MCP Server
 *
 * Methods:
 *   track_package(tracking_number, carrier) (2¢)
 *   detect_carrier(tracking_number)         (1¢)
 *   get_carriers()                          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TrackPackageInput { tracking_number: string; carrier?: string }
interface DetectCarrierInput { tracking_number: string }

const API_BASE = 'https://api.17track.net/track/v2'
const USER_AGENT = 'settlegrid-tracking/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, body: unknown): Promise<T> {
  const key = process.env.TRACKING_API_KEY || ''
  if (!key) throw new Error('TRACKING_API_KEY is required')
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/json', '17token': key },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`17track API ${res.status}`)
  return res.json() as Promise<T>
}

const CARRIERS: Record<string, string> = {
  ups: 'UPS', fedex: 'FedEx', usps: 'USPS', dhl: 'DHL', tnt: 'TNT',
  aramex: 'Aramex', dpd: 'DPD', gls: 'GLS', royalmail: 'Royal Mail',
}

const sg = settlegrid.init({
  toolSlug: 'tracking',
  pricing: { defaultCostCents: 1, methods: {
    track_package: { costCents: 2, displayName: 'Track a package' },
    detect_carrier: { costCents: 1, displayName: 'Detect carrier from number' },
    get_carriers: { costCents: 1, displayName: 'List supported carriers' },
  }},
})

const trackPackage = sg.wrap(async (args: TrackPackageInput) => {
  if (!args.tracking_number) throw new Error('tracking_number is required')
  const data = await apiFetch<Record<string, unknown>>('/gettrackinfo', [
    { number: args.tracking_number, ...(args.carrier ? { carrier: args.carrier } : {}) },
  ])
  return { tracking_number: args.tracking_number, ...data }
}, { method: 'track_package' })

const detectCarrier = sg.wrap(async (args: DetectCarrierInput) => {
  if (!args.tracking_number) throw new Error('tracking_number is required')
  const data = await apiFetch<Record<string, unknown>>('/detect', [{ number: args.tracking_number }])
  return { tracking_number: args.tracking_number, ...data }
}, { method: 'detect_carrier' })

const getCarriers = sg.wrap(async () => {
  return { count: Object.keys(CARRIERS).length, carriers: CARRIERS }
}, { method: 'get_carriers' })

export { trackPackage, detectCarrier, getCarriers }

console.log('settlegrid-tracking MCP server ready')
console.log('Methods: track_package, detect_carrier, get_carriers')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
