/**
 * settlegrid-pokemon-data — Pokemon Data MCP Server
 *
 * Wraps PokeAPI with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_pokemon(name) — Pokemon info (1¢)
 *   get_pokemon_species(name) — species info (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface PokemonInput { name: string }

const API_BASE = 'https://pokeapi.co/api/v2'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Pokemon not found')
    throw new Error(`API ${res.status}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'pokemon-data',
  pricing: { defaultCostCents: 1, methods: { get_pokemon: { costCents: 1, displayName: 'Get Pokemon' }, get_pokemon_species: { costCents: 1, displayName: 'Pokemon Species' } } },
})

const getPokemon = sg.wrap(async (args: PokemonInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(`/pokemon/${args.name.toLowerCase()}`)
  return {
    id: data.id, name: data.name, height: data.height, weight: data.weight,
    types: data.types?.map((t: any) => t.type.name),
    abilities: data.abilities?.map((a: any) => ({ name: a.ability.name, hidden: a.is_hidden })),
    stats: data.stats?.map((s: any) => ({ name: s.stat.name, value: s.base_stat })),
    sprite: data.sprites?.front_default,
  }
}, { method: 'get_pokemon' })

const getPokemonSpecies = sg.wrap(async (args: PokemonInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(`/pokemon-species/${args.name.toLowerCase()}`)
  return {
    id: data.id, name: data.name, color: data.color?.name,
    habitat: data.habitat?.name, shape: data.shape?.name,
    generation: data.generation?.name, is_legendary: data.is_legendary,
    is_mythical: data.is_mythical, capture_rate: data.capture_rate,
    base_happiness: data.base_happiness,
    flavor_text: data.flavor_text_entries?.find((f: any) => f.language.name === 'en')?.flavor_text?.replace(/\n/g, ' '),
    genus: data.genera?.find((g: any) => g.language.name === 'en')?.genus,
  }
}, { method: 'get_pokemon_species' })

export { getPokemon, getPokemonSpecies }

console.log('settlegrid-pokemon-data MCP server ready')
console.log('Methods: get_pokemon, get_pokemon_species')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
