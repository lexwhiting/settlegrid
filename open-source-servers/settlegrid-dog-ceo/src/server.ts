/**
 * settlegrid-dog-ceo — Dog CEO MCP Server
 *
 * Get random dog images and breed lists from the Dog CEO API.
 *
 * Methods:
 *   random_image()                — Get a random dog image URL  (1¢)
 *   list_breeds()                 — List all dog breeds  (1¢)
 *   breed_images(breed)           — Get random images for a specific breed  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RandomImageInput {

}

interface ListBreedsInput {

}

interface BreedImagesInput {
  breed: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://dog.ceo/api'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-dog-ceo/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Dog CEO API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'dog-ceo',
  pricing: {
    defaultCostCents: 1,
    methods: {
      random_image: { costCents: 1, displayName: 'Random Image' },
      list_breeds: { costCents: 1, displayName: 'List Breeds' },
      breed_images: { costCents: 1, displayName: 'Breed Images' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const randomImage = sg.wrap(async (args: RandomImageInput) => {

  const data = await apiFetch<any>(`/breeds/image/random`)
  return {
    message: data.message,
    status: data.status,
  }
}, { method: 'random_image' })

const listBreeds = sg.wrap(async (args: ListBreedsInput) => {

  const data = await apiFetch<any>(`/breeds/list/all`)
  return {
    message: data.message,
    status: data.status,
  }
}, { method: 'list_breeds' })

const breedImages = sg.wrap(async (args: BreedImagesInput) => {
  if (!args.breed || typeof args.breed !== 'string') throw new Error('breed is required')
  const breed = args.breed.trim()
  const data = await apiFetch<any>(`/breed/${encodeURIComponent(breed)}/images/random/3`)
  return {
    message: data.message,
    status: data.status,
  }
}, { method: 'breed_images' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { randomImage, listBreeds, breedImages }

console.log('settlegrid-dog-ceo MCP server ready')
console.log('Methods: random_image, list_breeds, breed_images')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
