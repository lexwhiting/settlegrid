/**
 * settlegrid-nasa-data — NASA Open APIs MCP Server
 *
 * Wraps NASA's free public APIs with SettleGrid billing.
 * Works with DEMO_KEY but a free API key from api.nasa.gov gives higher limits.
 *
 * Methods:
 *   get_apod()                          — Astronomy Picture of the Day  (1¢)
 *   get_neo(startDate, endDate)         — Near-Earth Objects tracker    (2¢)
 *   search_images(query)                — NASA Image & Video Library    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApodInput {
  date?: string
}

interface NeoInput {
  startDate: string
  endDate?: string
}

interface SearchImagesInput {
  query: string
  mediaType?: 'image' | 'video' | 'audio'
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getNasaKey(): string {
  return process.env.NASA_API_KEY ?? 'DEMO_KEY'
}

function validateDate(date: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`${field} must be in YYYY-MM-DD format (e.g. "2024-01-15")`)
  }
  return date
}

async function nasaFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NASA API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nasa-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_apod: { costCents: 1, displayName: 'Astronomy Picture of the Day' },
      get_neo: { costCents: 2, displayName: 'Near-Earth Objects' },
      search_images: { costCents: 1, displayName: 'Image Search' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getApod = sg.wrap(async (args: ApodInput) => {
  const params = new URLSearchParams({ api_key: getNasaKey() })
  if (args.date) {
    params.set('date', validateDate(args.date, 'date'))
  }

  const data = await nasaFetch<{
    title: string
    date: string
    explanation: string
    url: string
    hdurl?: string
    media_type: string
    copyright?: string
  }>(`https://api.nasa.gov/planetary/apod?${params}`)

  return {
    title: data.title,
    date: data.date,
    explanation: data.explanation,
    imageUrl: data.url,
    hdImageUrl: data.hdurl ?? null,
    mediaType: data.media_type,
    copyright: data.copyright ?? null,
  }
}, { method: 'get_apod' })

const getNeo = sg.wrap(async (args: NeoInput) => {
  if (!args.startDate) {
    throw new Error('startDate is required (YYYY-MM-DD)')
  }
  const startDate = validateDate(args.startDate, 'startDate')

  // Default end date is start date + 7 days (API max range)
  let endDate: string
  if (args.endDate) {
    endDate = validateDate(args.endDate, 'endDate')
  } else {
    const end = new Date(startDate)
    end.setDate(end.getDate() + 7)
    endDate = end.toISOString().split('T')[0]
  }

  const params = new URLSearchParams({
    api_key: getNasaKey(),
    start_date: startDate,
    end_date: endDate,
  })

  const data = await nasaFetch<{
    element_count: number
    near_earth_objects: Record<string, Array<{
      id: string
      name: string
      estimated_diameter: {
        meters: { estimated_diameter_min: number; estimated_diameter_max: number }
      }
      is_potentially_hazardous_asteroid: boolean
      close_approach_data: Array<{
        close_approach_date: string
        relative_velocity: { kilometers_per_hour: string }
        miss_distance: { kilometers: string }
      }>
    }>>
  }>(`https://api.nasa.gov/neo/rest/v1/feed?${params}`)

  const allObjects = Object.entries(data.near_earth_objects)
    .flatMap(([date, objects]) =>
      objects.map((obj) => ({
        id: obj.id,
        name: obj.name,
        date,
        diameterMeters: {
          min: Math.round(obj.estimated_diameter.meters.estimated_diameter_min),
          max: Math.round(obj.estimated_diameter.meters.estimated_diameter_max),
        },
        isHazardous: obj.is_potentially_hazardous_asteroid,
        approach: obj.close_approach_data[0]
          ? {
              date: obj.close_approach_data[0].close_approach_date,
              velocityKmh: Math.round(parseFloat(obj.close_approach_data[0].relative_velocity.kilometers_per_hour)),
              missDistanceKm: Math.round(parseFloat(obj.close_approach_data[0].miss_distance.kilometers)),
            }
          : null,
      }))
    )
    .sort((a, b) => (a.approach?.missDistanceKm ?? Infinity) - (b.approach?.missDistanceKm ?? Infinity))

  return {
    dateRange: { start: startDate, end: endDate },
    totalCount: data.element_count,
    hazardousCount: allObjects.filter((o) => o.isHazardous).length,
    objects: allObjects.slice(0, 50),
  }
}, { method: 'get_neo' })

const searchImages = sg.wrap(async (args: SearchImagesInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (e.g. "mars rover", "earth from space")')
  }
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100)

  const params = new URLSearchParams({
    q: args.query.trim(),
    page_size: String(limit),
  })
  if (args.mediaType) {
    params.set('media_type', args.mediaType)
  }

  const data = await nasaFetch<{
    collection: {
      items: Array<{
        data: Array<{
          title: string
          description?: string
          date_created: string
          nasa_id: string
          media_type: string
          keywords?: string[]
        }>
        links?: Array<{ href: string; rel: string }>
      }>
      metadata: { total_hits: number }
    }
  }>(`https://images-api.nasa.gov/search?${params}`)

  return {
    query: args.query,
    totalHits: data.collection.metadata.total_hits,
    results: data.collection.items.slice(0, limit).map((item) => {
      const info = item.data[0]
      const thumbnail = item.links?.find((l) => l.rel === 'preview')?.href
      return {
        title: info.title,
        description: info.description?.slice(0, 500) ?? null,
        date: info.date_created,
        nasaId: info.nasa_id,
        mediaType: info.media_type,
        keywords: info.keywords?.slice(0, 10) ?? [],
        thumbnailUrl: thumbnail ?? null,
      }
    }),
  }
}, { method: 'search_images' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getApod, getNeo, searchImages }

// ─── REST Alternative (uncomment to serve as HTTP) ──────────────────────────
//
// import { settlegridMiddleware } from '@settlegrid/mcp'
// const middleware = settlegridMiddleware({
//   toolSlug: 'nasa-data',
//   pricing: { defaultCostCents: 1, methods: { get_neo: { costCents: 2 } } },
//   routes: { ... },
// })

console.log('settlegrid-nasa-data MCP server ready')
console.log('Methods: get_apod, get_neo, search_images')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
