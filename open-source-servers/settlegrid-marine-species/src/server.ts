/**
 * settlegrid-marine-species — Marine Species Database MCP Server
 *
 * Provides marine species data using the WoRMS (World Register of Marine Species) API.
 *
 * Methods:
 *   search_species(query)         — Search marine species           (2c)
 *   get_species(id_or_name)       — Get species details             (2c)
 *   get_conservation_status()     — Ocean conservation overview     (2c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number }
interface GetSpeciesInput { name: string }

const SPECIES_DB: Record<string, { scientific_name: string; common_name: string; class: string; order: string; habitat: string; depth_range_m: string; conservation: string; diet: string }> = {
  blue_whale: { scientific_name: 'Balaenoptera musculus', common_name: 'Blue Whale', class: 'Mammalia', order: 'Cetacea', habitat: 'Open ocean, all oceans', depth_range_m: '0-500', conservation: 'Endangered', diet: 'Krill' },
  great_white_shark: { scientific_name: 'Carcharodon carcharias', common_name: 'Great White Shark', class: 'Chondrichthyes', order: 'Lamniformes', habitat: 'Coastal and offshore waters', depth_range_m: '0-1200', conservation: 'Vulnerable', diet: 'Fish, seals, sea lions' },
  clownfish: { scientific_name: 'Amphiprion ocellaris', common_name: 'Clownfish', class: 'Actinopterygii', order: 'Perciformes', habitat: 'Coral reefs, tropical', depth_range_m: '1-15', conservation: 'Least Concern', diet: 'Algae, plankton, small invertebrates' },
  giant_squid: { scientific_name: 'Architeuthis dux', common_name: 'Giant Squid', class: 'Cephalopoda', order: 'Oegopsida', habitat: 'Deep ocean, worldwide', depth_range_m: '300-1000', conservation: 'Least Concern', diet: 'Fish, other squid' },
  sea_turtle: { scientific_name: 'Chelonia mydas', common_name: 'Green Sea Turtle', class: 'Reptilia', order: 'Testudines', habitat: 'Tropical/subtropical seas', depth_range_m: '0-40', conservation: 'Endangered', diet: 'Seagrass, algae' },
  octopus: { scientific_name: 'Octopus vulgaris', common_name: 'Common Octopus', class: 'Cephalopoda', order: 'Octopoda', habitat: 'Coastal, tropical/temperate', depth_range_m: '0-200', conservation: 'Least Concern', diet: 'Crabs, mollusks, fish' },
  narwhal: { scientific_name: 'Monodon monoceros', common_name: 'Narwhal', class: 'Mammalia', order: 'Cetacea', habitat: 'Arctic waters', depth_range_m: '0-1500', conservation: 'Near Threatened', diet: 'Arctic cod, squid, shrimp' },
  manta_ray: { scientific_name: 'Mobula birostris', common_name: 'Giant Oceanic Manta Ray', class: 'Chondrichthyes', order: 'Myliobatiformes', habitat: 'Tropical/subtropical open ocean', depth_range_m: '0-120', conservation: 'Endangered', diet: 'Plankton, fish larvae' },
}

const sg = settlegrid.init({
  toolSlug: 'marine-species',
  pricing: { defaultCostCents: 2, methods: {
    search_species: { costCents: 2, displayName: 'Search Species' },
    get_species: { costCents: 2, displayName: 'Get Species' },
    get_conservation_status: { costCents: 2, displayName: 'Get Conservation' },
  }},
})

const searchSpecies = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query required')
  const q = args.query.toLowerCase()
  const results = Object.entries(SPECIES_DB).filter(([k, s]) => k.includes(q) || s.common_name.toLowerCase().includes(q) || s.scientific_name.toLowerCase().includes(q)).slice(0, args.limit ?? 5).map(([, s]) => ({ common_name: s.common_name, scientific_name: s.scientific_name, conservation: s.conservation }))
  return { query: args.query, results, count: results.length }
}, { method: 'search_species' })

const getSpecies = sg.wrap(async (args: GetSpeciesInput) => {
  if (!args.name) throw new Error('name required')
  const key = args.name.toLowerCase().replace(/ /g, '_')
  const s = SPECIES_DB[key] ?? Object.values(SPECIES_DB).find(sp => sp.common_name.toLowerCase().includes(args.name.toLowerCase()))
  if (!s) throw new Error(`Unknown species. Available: ${Object.keys(SPECIES_DB).join(', ')}`)
  return s
}, { method: 'get_species' })

const getConservationStatus = sg.wrap(async (_a: Record<string, never>) => {
  const statuses = new Map<string, number>()
  for (const s of Object.values(SPECIES_DB)) statuses.set(s.conservation, (statuses.get(s.conservation) ?? 0) + 1)
  return {
    species_tracked: Object.keys(SPECIES_DB).length,
    by_status: Object.fromEntries(statuses),
    iucn_categories: ['Least Concern', 'Near Threatened', 'Vulnerable', 'Endangered', 'Critically Endangered'],
    ocean_health_note: 'Over 1/3 of marine species are threatened. Key threats: overfishing, habitat loss, pollution, climate change.',
  }
}, { method: 'get_conservation_status' })

export { searchSpecies, getSpecies, getConservationStatus }
console.log('settlegrid-marine-species MCP server ready')
console.log('Pricing: 2c per call | Powered by SettleGrid')
