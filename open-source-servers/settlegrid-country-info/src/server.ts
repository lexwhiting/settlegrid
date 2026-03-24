/**
 * settlegrid-country-info — Country Information MCP Server
 *
 * Wraps RestCountries v3.1 with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_country(name) — country by name (1¢)
 *   get_country_by_code(code) — country by code (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface NameInput { name: string }
interface CodeInput { code: string }

const API_BASE = 'https://restcountries.com/v3.1'

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(res.status === 404 ? 'Country not found' : `API ${res.status}`)
  return res.json() as Promise<T>
}

function mapCountry(c: any) {
  return {
    name: c.name?.common, official_name: c.name?.official, cca2: c.cca2, cca3: c.cca3,
    capital: c.capital, region: c.region, subregion: c.subregion,
    population: c.population, area_km2: c.area, timezones: c.timezones,
    currencies: c.currencies ? Object.values(c.currencies).map((cu: any) => cu.name) : [],
    languages: c.languages ? Object.values(c.languages) : [],
    flag_emoji: c.flag, flag_png: c.flags?.png, borders: c.borders,
    latlng: c.latlng, landlocked: c.landlocked, un_member: c.unMember,
  }
}

const sg = settlegrid.init({
  toolSlug: 'country-info',
  pricing: { defaultCostCents: 1, methods: { get_country: { costCents: 1, displayName: 'Get Country' }, get_country_by_code: { costCents: 1, displayName: 'Country By Code' } } },
})

const getCountry = sg.wrap(async (args: NameInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any[]>(`/name/${encodeURIComponent(args.name)}`)
  return { countries: data.map(mapCountry) }
}, { method: 'get_country' })

const getCountryByCode = sg.wrap(async (args: CodeInput) => {
  if (!args.code) throw new Error('code is required')
  const data = await apiFetch<any[]>(`/alpha/${args.code}`)
  return { country: mapCountry(data[0]) }
}, { method: 'get_country_by_code' })

export { getCountry, getCountryByCode }

console.log('settlegrid-country-info MCP server ready')
console.log('Methods: get_country, get_country_by_code')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
