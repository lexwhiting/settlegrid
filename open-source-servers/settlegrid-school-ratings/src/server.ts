/**
 * settlegrid-school-ratings — SchoolDigger MCP Server
 *
 * School quality ratings and rankings from SchoolDigger.
 *
 * Methods:
 *   search_schools(st, city)      — Search schools by location  (2¢)
 *   get_school(id)                — Get details for a school by ID  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchSchoolsInput {
  st: string
  city?: string
}

interface GetSchoolInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.schooldigger.com/v2.0'
const API_KEY = process.env.SCHOOLDIGGER_APP_ID ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-school-ratings/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`SchoolDigger API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'school-ratings',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_schools: { costCents: 2, displayName: 'Search Schools' },
      get_school: { costCents: 2, displayName: 'Get School' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchSchools = sg.wrap(async (args: SearchSchoolsInput) => {
  if (!args.st || typeof args.st !== 'string') throw new Error('st is required')
  const st = args.st.trim()
  const city = typeof args.city === 'string' ? args.city.trim() : ''
  const data = await apiFetch<any>(`/schools?st=${encodeURIComponent(st)}${city ? "&city=" + city : ""}&perPage=10&appKey=${process.env.SCHOOLDIGGER_APP_KEY || ""}&appID=${API_KEY}`)
  const items = (data.schoolList ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        schoolid: item.schoolid,
        schoolName: item.schoolName,
        city: item.city,
        state: item.state,
        rankHistory: item.rankHistory,
        schoolLevel: item.schoolLevel,
    })),
  }
}, { method: 'search_schools' })

const getSchool = sg.wrap(async (args: GetSchoolInput) => {
  if (!args.id || typeof args.id !== 'string') throw new Error('id is required')
  const id = args.id.trim()
  const data = await apiFetch<any>(`/schools/${encodeURIComponent(id)}?appKey=${process.env.SCHOOLDIGGER_APP_KEY || ""}&appID=${API_KEY}`)
  return {
    schoolid: data.schoolid,
    schoolName: data.schoolName,
    address: data.address,
    phone: data.phone,
    schoolLevel: data.schoolLevel,
    rankHistory: data.rankHistory,
    testScores: data.testScores,
  }
}, { method: 'get_school' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchSchools, getSchool }

console.log('settlegrid-school-ratings MCP server ready')
console.log('Methods: search_schools, get_school')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
