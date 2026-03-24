/**
 * settlegrid-dog-ceo — Dog CEO MCP Server
 *
 * Methods:
 *   get_random_image(count?)   — Random dog image(s)    (1¢)
 *   get_breed_image(breed)     — Breed-specific image   (1¢)
 *   list_breeds()              — List all breeds        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RandomInput { count?: number }
interface BreedInput { breed: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://dog.ceo/api'

async function dogFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Dog CEO API ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json() as T & { status?: string }
  if (data.status === 'error') throw new Error('Dog breed not found')
  return data
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'dog-ceo',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_random_image: { costCents: 1, displayName: 'Random Dog Image' },
      get_breed_image: { costCents: 1, displayName: 'Breed Image' },
      list_breeds: { costCents: 1, displayName: 'List Breeds' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRandomImage = sg.wrap(async (args: RandomInput) => {
  if (args.count && args.count > 1) {
    const count = Math.min(Math.max(args.count, 1), 50)
    const data = await dogFetch<{ message: string[] }>(`/breeds/image/random/${count}`)
    return { count: data.message.length, images: data.message }
  }
  const data = await dogFetch<{ message: string }>('/breeds/image/random')
  return { image: data.message }
}, { method: 'get_random_image' })

const getBreedImage = sg.wrap(async (args: BreedInput) => {
  if (!args.breed || typeof args.breed !== 'string') throw new Error('breed is required')
  const breed = args.breed.toLowerCase().trim().replace(/\s+/g, '/')
  if (!/^[a-z]+(/[a-z]+)?$/.test(breed)) throw new Error('Invalid breed name')
  const data = await dogFetch<{ message: string }>(`/breed/${breed}/images/random`)
  return { breed: args.breed, image: data.message }
}, { method: 'get_breed_image' })

const listBreeds = sg.wrap(async () => {
  const data = await dogFetch<{ message: Record<string, string[]> }>('/breeds/list/all')
  const breeds = Object.entries(data.message).map(([breed, subBreeds]) => ({
    breed,
    subBreeds: subBreeds.length > 0 ? subBreeds : undefined,
  }))
  return { count: breeds.length, breeds }
}, { method: 'list_breeds' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRandomImage, getBreedImage, listBreeds }

console.log('settlegrid-dog-ceo MCP server ready')
console.log('Methods: get_random_image, get_breed_image, list_breeds')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
