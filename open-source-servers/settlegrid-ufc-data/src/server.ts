/**
 * settlegrid-ufc-data — UFC Data (ESPN) MCP Server
 *
 * UFC mixed martial arts data — events, fighters, and results via ESPN API.
 *
 * Methods:
 *   get_scoreboard()              — Get current/recent UFC event scores  (1¢)
 *   get_news()                    — Get latest UFC news headlines  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetScoreboardInput {

}

interface GetNewsInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-ufc-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`UFC Data (ESPN) API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ufc-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_scoreboard: { costCents: 1, displayName: 'Get Scoreboard' },
      get_news: { costCents: 1, displayName: 'Get News' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScoreboard = sg.wrap(async (args: GetScoreboardInput) => {

  const data = await apiFetch<any>(`/scoreboard`)
  const items = (data.events ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        shortName: item.shortName,
        date: item.date,
        status: item.status,
        competitions: item.competitions,
    })),
  }
}, { method: 'get_scoreboard' })

const getNews = sg.wrap(async (args: GetNewsInput) => {

  const data = await apiFetch<any>(`/news`)
  const items = (data.articles ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        headline: item.headline,
        description: item.description,
        published: item.published,
        links: item.links,
    })),
  }
}, { method: 'get_news' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScoreboard, getNews }

console.log('settlegrid-ufc-data MCP server ready')
console.log('Methods: get_scoreboard, get_news')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
