/**
 * settlegrid-random-user — Random User Generator MCP Server
 *
 * Generate random user profiles for testing and development.
 *
 * Methods:
 *   generate_users(count, nationality) — Generate random user profiles  (1¢)
 *   generate_user(nationality)    — Generate a single random user with full details  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GenerateUsersInput {
  count?: number
  nationality?: string
}

interface GenerateUserInput {
  nationality?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://randomuser.me/api'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-random-user/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Random User Generator API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'random-user',
  pricing: {
    defaultCostCents: 1,
    methods: {
      generate_users: { costCents: 1, displayName: 'Generate Users' },
      generate_user: { costCents: 1, displayName: 'Generate User' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const generateUsers = sg.wrap(async (args: GenerateUsersInput) => {
  const count = typeof args.count === 'number' ? args.count : 0
  const nationality = typeof args.nationality === 'string' ? args.nationality.trim() : ''
  const data = await apiFetch<any>(`/?results=${count}&nat=${encodeURIComponent(nationality)}&noinfo`)
  const items = (data.results ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        name: item.name,
        email: item.email,
        location: item.location,
        phone: item.phone,
        picture: item.picture,
    })),
  }
}, { method: 'generate_users' })

const generateUser = sg.wrap(async (args: GenerateUserInput) => {
  const nationality = typeof args.nationality === 'string' ? args.nationality.trim() : ''
  const data = await apiFetch<any>(`/?results=1&nat=${encodeURIComponent(nationality)}&noinfo`)
  const items = (data.results ?? []).slice(0, 1)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        name: item.name,
        email: item.email,
        location: item.location,
        phone: item.phone,
        login: item.login,
        dob: item.dob,
        picture: item.picture,
    })),
  }
}, { method: 'generate_user' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { generateUsers, generateUser }

console.log('settlegrid-random-user MCP server ready')
console.log('Methods: generate_users, generate_user')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
