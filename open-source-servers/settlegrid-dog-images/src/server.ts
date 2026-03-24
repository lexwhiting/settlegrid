/**
 * settlegrid-dog-images — Dog Images MCP Server
 *
 * Wraps the Dog CEO API with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   random_image()                        (1¢)
 *   breed_image(breed)                    (1¢)
 *   list_breeds()                         (1¢)
 *   random_by_breed(breed, count)         (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface BreedInput { breed: string }
interface BreedImagesInput { breed: string; count?: number }

const API_BASE = "https://dog.ceo/api"
const USER_AGENT = "settlegrid-dog-images/1.0 (contact@settlegrid.ai)"

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`Dog CEO API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "dog-images",
  pricing: {
    defaultCostCents: 1,
    methods: {
      random_image: { costCents: 1, displayName: "Get a random dog image" },
      breed_image: { costCents: 1, displayName: "Get image by breed" },
      list_breeds: { costCents: 1, displayName: "List all dog breeds" },
      random_by_breed: { costCents: 1, displayName: "Multiple images by breed" },
    },
  },
})

const randomImage = sg.wrap(async () => {
  return apiFetch<Record<string, unknown>>("/breeds/image/random")
}, { method: "random_image" })

const breedImage = sg.wrap(async (args: BreedInput) => {
  if (!args.breed || typeof args.breed !== "string") throw new Error("breed is required")
  return apiFetch<Record<string, unknown>>(`/breed/${encodeURIComponent(args.breed.toLowerCase())}/images/random`)
}, { method: "breed_image" })

const listBreeds = sg.wrap(async () => {
  const data = await apiFetch<{ message: Record<string, string[]>; status: string }>("/breeds/list/all")
  const breeds = Object.entries(data.message).map(([breed, subBreeds]) => ({
    breed, sub_breeds: subBreeds, has_sub_breeds: subBreeds.length > 0,
  }))
  return { count: breeds.length, breeds }
}, { method: "list_breeds" })

const randomByBreed = sg.wrap(async (args: BreedImagesInput) => {
  if (!args.breed || typeof args.breed !== "string") throw new Error("breed is required")
  const count = args.count ?? 5
  if (count > 50) throw new Error("Maximum 50 images")
  return apiFetch<Record<string, unknown>>(`/breed/${encodeURIComponent(args.breed.toLowerCase())}/images/random/${count}`)
}, { method: "random_by_breed" })

export { randomImage, breedImage, listBreeds, randomByBreed }

console.log("settlegrid-dog-images MCP server ready")
console.log("Methods: random_image, breed_image, list_breeds, random_by_breed")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
