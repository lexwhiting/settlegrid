# Example: Plain TypeScript Functions to Monetized MCP Tools

A raw TypeScript file with plain exported functions — no MCP framework at all. This example promotes them to billed tools served over HTTP using `settlegridMiddleware`.

## Before

```typescript
interface GeoResult {
  lat: number
  lon: number
  name: string
}

interface ReverseResult {
  address: string
  country: string
}

export async function geocode(address: string): Promise<GeoResult> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
  const res = await fetch(url, { headers: { 'User-Agent': 'settlegrid-geo/1.0' } })
  const data = await res.json()
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`No results for "${address}"`)
  }
  return { lat: Number(data[0].lat), lon: Number(data[0].lon), name: data[0].display_name }
}

export async function reverseGeocode(lat: number, lon: number): Promise<ReverseResult> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
  const res = await fetch(url, { headers: { 'User-Agent': 'settlegrid-geo/1.0' } })
  const data = await res.json()
  return { address: data.display_name ?? 'unknown', country: data.address?.country ?? 'unknown' }
}

export async function batchGeocode(addresses: string[]): Promise<GeoResult[]> {
  return Promise.all(addresses.map(geocode))
}
```

## After

```typescript
import { settlegrid, settlegridMiddleware } from '@settlegrid/mcp'

interface GeoResult {
  lat: number
  lon: number
  name: string
}

interface ReverseResult {
  address: string
  country: string
}

const sg = settlegrid.init({
  toolSlug: 'geocoding',
  pricing: {
    defaultCostCents: 1,
    methods: {
      geocode: { costCents: 1, displayName: 'Geocode Address' },
      reverse_geocode: { costCents: 1, displayName: 'Reverse Geocode' },
      batch_geocode: { costCents: 5, displayName: 'Batch Geocode (up to 10)' },
    },
  },
})

export const geocode = sg.wrap(
  async (args: { address: string }): Promise<GeoResult> => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(args.address)}&format=json&limit=1`
    const res = await fetch(url, { headers: { 'User-Agent': 'settlegrid-geo/1.0' } })
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`No results for "${args.address}"`)
    }
    return { lat: Number(data[0].lat), lon: Number(data[0].lon), name: data[0].display_name }
  },
  { method: 'geocode' }
)

export const reverseGeocode = sg.wrap(
  async (args: { lat: number; lon: number }): Promise<ReverseResult> => {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${args.lat}&lon=${args.lon}&format=json`
    const res = await fetch(url, { headers: { 'User-Agent': 'settlegrid-geo/1.0' } })
    const data = await res.json()
    return { address: data.display_name ?? 'unknown', country: data.address?.country ?? 'unknown' }
  },
  { method: 'reverse_geocode' }
)

export const batchGeocode = sg.wrap(
  async (args: { addresses: string[] }): Promise<GeoResult[]> => {
    return Promise.all(args.addresses.map((addr) =>
      geocode({ address: addr }, { headers: { 'x-api-key': process.env.SETTLEGRID_API_KEY ?? '' } })
    ))
  },
  { method: 'batch_geocode' }
)

const withBilling = settlegridMiddleware({
  toolSlug: 'geocoding',
  pricing: { defaultCostCents: 1 },
})

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/geocode') {
      return withBilling(req, async () => {
        const { address } = await req.json()
        const result = await geocode({ address }, { headers: Object.fromEntries(req.headers) })
        return Response.json(result)
      })
    }
    if (url.pathname === '/reverse') {
      return withBilling(req, async () => {
        const { lat, lon } = await req.json()
        const result = await reverseGeocode({ lat, lon }, { headers: Object.fromEntries(req.headers) })
        return Response.json(result)
      })
    }
    return new Response('Not Found', { status: 404 })
  },
})

console.log(`geocoding server ready on port ${server.port}`)
```

### Key Changes

- **Line 1**: Added `settlegrid` and `settlegridMiddleware` imports.
- **Lines 14-27**: Added `settlegrid.init()` with three methods at differentiated prices — batch costs 5x because it fans out to multiple API calls.
- **Lines 29-57**: Each plain function is now an `sg.wrap()` call. The function signature changes from positional args (`address: string`) to a single args object (`args: { address: string }`) because `sg.wrap` passes a single argument.
- **Lines 59-63**: `settlegridMiddleware` creates a billing wrapper for HTTP routes. Each route calls `withBilling(req, handler)` which extracts the API key from the `x-api-key` header automatically.
- **Lines 65-85**: A minimal Bun HTTP server exposes `/geocode` and `/reverse` as billed REST endpoints.

### Dashboard View

The SettleGrid dashboard shows three method rows. "Batch Geocode" has fewer invocations but higher revenue per call (5c vs 1c). The "Top Consumers" table reveals which API key owners generate the most traffic, helping the operator prioritize support for high-value users.

### Revenue Math

- **Calls/day**: 200 (geocode 100, reverse 80, batch 20)
- **Weighted average**: (100×1 + 80×1 + 20×5) / 200 = 1.4 cents/call
- **Projected monthly**: 200 × 1.4 × 30 = **$84/month**
