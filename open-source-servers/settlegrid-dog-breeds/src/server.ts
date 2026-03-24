/**
 * settlegrid-dog-breeds — Dog Breeds MCP Server
 *
 * Wraps Dog CEO API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   list_dog_breeds() — all breeds (1¢)
 *   get_breed_image(breed) — breed image (1¢)
 *   get_random_dog() — random dog (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface BreedInput { breed: string }

const API_BASE = 'https://dog.ceo/api'

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'dog-breeds',
  pricing: { defaultCostCents: 1, methods: { list_dog_breeds: { costCents: 1, displayName: 'List Breeds' }, get_breed_image: { costCents: 1, displayName: 'Breed Image' }, get_random_dog: { costCents: 1, displayName: 'Random Dog' } } },
})

const listDogBreeds = sg.wrap(async () => {
  const data = await apiFetch<any>('/breeds/list/all')
  const breeds = Object.entries(data.message || {}).map(([breed, subs]: [string, any]) => ({
    breed, sub_breeds: subs,
  }))
  return { total: breeds.length, breeds }
}, { method: 'list_dog_breeds' })

const getBreedImage = sg.wrap(async (args: BreedInput) => {
  if (!args.breed) throw new Error('breed is required')
  const data = await apiFetch<any>(`/breed/${args.breed.toLowerCase()}/images/random`)
  if (data.status !== 'success') throw new Error('Breed not found')
  return { breed: args.breed, image_url: data.message }
}, { method: 'get_breed_image' })

const getRandomDog = sg.wrap(async () => {
  const data = await apiFetch<any>('/breeds/image/random')
  return { image_url: data.message }
}, { method: 'get_random_dog' })

export { listDogBreeds, getBreedImage, getRandomDog }

console.log('settlegrid-dog-breeds MCP server ready')
console.log('Methods: list_dog_breeds, get_breed_image, get_random_dog')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
