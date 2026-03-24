/**
 * settlegrid-jokeapi — JokeAPI MCP Server
 *
 * Wraps JokeAPI with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_joke(category?, type?) — random joke (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface JokeInput { category?: string; type?: string }

const API_BASE = 'https://v2.jokeapi.dev'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'jokeapi',
  pricing: { defaultCostCents: 1, methods: { get_joke: { costCents: 1, displayName: 'Get Joke' } } },
})

const getJoke = sg.wrap(async (args: JokeInput) => {
  const cat = args.category || 'Any'
  const params = args.type ? `?type=${args.type}` : ''
  const data = await apiFetch<any>(`/joke/${cat}${params}`)
  if (data.error) throw new Error(data.message || 'Joke API error')
  if (data.type === 'single') {
    return { type: 'single', category: data.category, joke: data.joke, id: data.id, lang: data.lang }
  }
  return { type: 'twopart', category: data.category, setup: data.setup, delivery: data.delivery, id: data.id, lang: data.lang }
}, { method: 'get_joke' })

export { getJoke }

console.log('settlegrid-jokeapi MCP server ready')
console.log('Methods: get_joke')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
