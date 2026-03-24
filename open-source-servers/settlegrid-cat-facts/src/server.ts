/**
 * settlegrid-cat-facts — Cat Facts MCP Server
 *
 * Provides cat facts and breed data with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   get_fact()                            (1¢)
 *   get_facts(count)                      (1¢)
 *   get_breeds()                          (1¢)
 *   get_breed(breed_id)                   (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface GetFactsInput { count?: number }
interface GetBreedInput { breed_id: string }

const USER_AGENT = "settlegrid-cat-facts/1.0 (contact@settlegrid.ai)"

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "cat-facts",
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_fact: { costCents: 1, displayName: "Get a random cat fact" },
      get_facts: { costCents: 1, displayName: "Get multiple cat facts" },
      get_breeds: { costCents: 1, displayName: "List cat breeds" },
      get_breed: { costCents: 1, displayName: "Get breed details" },
    },
  },
})

const getFact = sg.wrap(async () => {
  return apiFetch<Record<string, unknown>>("https://catfact.ninja/fact")
}, { method: "get_fact" })

const getFacts = sg.wrap(async (args: GetFactsInput) => {
  const count = args.count ?? 5
  if (count > 50) throw new Error("Maximum 50 facts")
  return apiFetch<Record<string, unknown>>(`https://catfact.ninja/facts?limit=${count}`)
}, { method: "get_facts" })

const getBreeds = sg.wrap(async () => {
  return apiFetch<Record<string, unknown>>("https://api.thecatapi.com/v1/breeds?limit=20")
}, { method: "get_breeds" })

const getBreed = sg.wrap(async (args: GetBreedInput) => {
  if (!args.breed_id || typeof args.breed_id !== "string") throw new Error("breed_id is required")
  const breeds = await apiFetch<Array<Record<string, unknown>>>("https://api.thecatapi.com/v1/breeds")
  const breed = breeds.find((b) => String(b.id) === args.breed_id || String(b.name).toLowerCase() === args.breed_id.toLowerCase())
  if (!breed) throw new Error(`Breed "${args.breed_id}" not found`)
  return breed
}, { method: "get_breed" })

export { getFact, getFacts, getBreeds, getBreed }

console.log("settlegrid-cat-facts MCP server ready")
console.log("Methods: get_fact, get_facts, get_breeds, get_breed")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
